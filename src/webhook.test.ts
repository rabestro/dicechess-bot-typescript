/**
 * Hermetic tests for the webhook handler — no network, no live server. The signature is computed
 * exactly as the server does — HMAC-SHA256(secret, "<ts>.<body>") — so a passing test proves the
 * handler would accept a genuine delivery and reject a forged one.
 */

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, handleDelivery, verifySignature } from './webhook.js';
import type { MoveTree } from './client.js';

const SECRET = 'test-secret';
const sign = (secret: string, ts: string, body: string) =>
	createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
const now = () => String(Math.floor(Date.now() / 1000));

test('valid signature passes', () => {
	const ts = now();
	const body = '{"hello":true}';
	assert.ok(verifySignature(SECRET, ts, body, sign(SECRET, ts, body)));
});

test('tampered body fails', () => {
	const ts = now();
	const sig = sign(SECRET, ts, '{"hello":true}');
	assert.equal(verifySignature(SECRET, ts, '{"hello":false}', sig), false);
});

test('stale timestamp fails', () => {
	const ts = String(Math.floor(Date.now() / 1000) - 3600);
	assert.equal(verifySignature(SECRET, ts, 'x', sign(SECRET, ts, 'x')), false);
});

test('missing pieces fail', () => {
	assert.equal(verifySignature(SECRET, undefined, 'x', 'y'), false);
	assert.equal(verifySignature(SECRET, 'not-a-number', 'x', 'y'), false);
});

test('verification echoes the nonce', async () => {
	const raw = JSON.stringify({ type: 'verification', nonce: 'abc123' });
	const { status, body } = await handleDelivery({}, raw, SECRET);
	assert.equal(status, 200);
	assert.deepEqual(body, { nonce: 'abc123' });
});

test('a signed turn returns a legal root-to-leaf path', async () => {
	const tree: MoveTree = { e2e4: { g1f3: {}, b1c3: {} }, d2d4: { d4d5: {} } };
	const raw = JSON.stringify({ type: 'yourTurn', gameId: 'g1', seat: 'White', state: { legalMoves: tree } });
	const ts = now();
	const headers = { [TIMESTAMP_HEADER]: ts, [SIGNATURE_HEADER]: sign(SECRET, ts, raw) };
	const { status, body } = await handleDelivery(headers, raw, SECRET);
	assert.equal(status, 200);
	let node: MoveTree = tree;
	for (const move of body.moves as string[]) {
		assert.ok(move in node);
		node = node[move];
	}
	assert.deepEqual(node, {}, 'path must end at a leaf');
});

test('a bad signature is rejected', async () => {
	const raw = JSON.stringify({ type: 'yourTurn', gameId: 'g1', seat: 'White', state: { legalMoves: {} } });
	const headers = { [TIMESTAMP_HEADER]: now(), [SIGNATURE_HEADER]: 'deadbeef' };
	const { status } = await handleDelivery(headers, raw, SECRET);
	assert.equal(status, 401);
});

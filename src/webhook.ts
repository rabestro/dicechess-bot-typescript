/**
 * Webhook delivery: signature verification and the turn handler.
 *
 * The push alternative to polling. Once you register an HTTPS callback (see
 * `BotClient.registerWebhook`), the server POSTs to it when it is your turn and **your HTTP
 * response body is the move**. This module is transport-only and stateless — it needs just the
 * per-bot `secret` to authenticate deliveries, never a token.
 *
 * The one delivery you cannot authenticate is the registration handshake
 * (`{"type":"verification"}`): the secret is disclosed only after it succeeds, so the handler
 * echoes that nonce unconditionally (leaking the nonce is harmless; no game action follows).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { DEFAULT_BASE_URL, USER_AGENT, type Clocks, type MoveTree } from './client.js';
import { chooseMove, type TurnContext } from './strategy.js';

export const SIGNATURE_HEADER = 'x-dicechess-signature';
export const TIMESTAMP_HEADER = 'x-dicechess-timestamp';
const MAX_SKEW_SECONDS = 300; // ±5 minutes — the documented replay window

/** True iff `signature` is `HMAC-SHA256(secret, "<timestamp>.<rawBody>")` (hex) and fresh. */
export function verifySignature(
	secret: string,
	timestamp: string | undefined,
	rawBody: string,
	signature: string | undefined,
): boolean {
	if (!timestamp || !signature) return false;
	const ts = Number(timestamp);
	if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) return false;
	const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
	if (expected.length !== signature.length) return false;
	return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export interface DeliveryResult {
	status: number;
	body: Record<string, unknown>;
}

/**
 * Turn one webhook POST into a `{ status, body }` response.
 * - `{"type":"verification"}` → `200 {"nonce": <echo>}` (the ownership handshake).
 * - `{"type":"yourTurn", ...}` with a valid signature → `200 {"moves": [...]}`.
 * - a bad or stale signature → `401` (submit nothing; your clock keeps running).
 */
export async function handleDelivery(
	headers: Record<string, string | undefined>,
	rawBody: string,
	secret: string,
	baseUrl: string = DEFAULT_BASE_URL,
): Promise<DeliveryResult> {
	const envelope = JSON.parse(rawBody);
	if (envelope.type === 'verification') {
		return { status: 200, body: { nonce: envelope.nonce } };
	}
	if (!verifySignature(secret, headers[TIMESTAMP_HEADER], rawBody, headers[SIGNATURE_HEADER])) {
		return { status: 401, body: { error: 'invalid signature' } };
	}
	let tree: MoveTree | null | undefined = envelope.state?.legalMoves;
	if (tree === null || tree === undefined) {
		tree = await fetchLegalMoves(baseUrl, envelope.gameId); // inline cap exceeded — public fetch
	}
	return { status: 200, body: { moves: await chooseMove(contextFromEnvelope(envelope, tree ?? {})) } };
}

/**
 * Build the strategy's `TurnContext` from a delivered `yourTurn` envelope and its (already
 * cap-resolved) legal-move tree. Exported and kept separate from `handleDelivery`'s dispatch
 * logic so the envelope→context mapping is directly unit-testable without a live delivery.
 */
export function contextFromEnvelope(envelope: { seat: 'White' | 'Black'; state?: Record<string, unknown> }, tree: MoveTree): TurnContext {
	return {
		dfen: (envelope.state?.dfen as string) ?? '',
		legalMoves: tree,
		activeSeat: envelope.seat,
		clocks: (envelope.state?.clocks as Clocks | null) ?? null,
	};
}

async function fetchLegalMoves(baseUrl: string, gameId: string): Promise<MoveTree> {
	const res = await fetch(`${baseUrl}/games/${gameId}/moves`, { headers: { 'User-Agent': USER_AGENT } });
	const data = (await res.json()) as { legalMoves?: MoveTree };
	return data.legalMoves ?? {};
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseMove, type TurnContext } from './strategy.js';
import type { MoveTree } from './client.js';

const baseCtx = (legalMoves: MoveTree): TurnContext => ({
	dfen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 NBK',
	legalMoves,
	activeSeat: 'White',
	clocks: { white: 180_000, black: 175_000 },
});

test('chooseMove walks a real root-to-leaf path of the legal-move tree', async () => {
	const tree: MoveTree = { e2e4: { g1f3: {}, b1c3: {} }, d2d4: { d4d5: {} } };
	const moves = await chooseMove(baseCtx(tree));
	let node: MoveTree = tree;
	for (const move of moves) {
		assert.ok(move in node, `${move} must be a legal continuation at this point in the tree`);
		node = node[move];
	}
	assert.deepEqual(node, {}, 'the path must end at a leaf — a complete legal turn');
});

test('chooseMove returns an empty path on a forced pass (empty tree)', async () => {
	assert.deepEqual(await chooseMove(baseCtx({})), []);
});

test('chooseMove accepts an Unlimited game (clocks: null) and a fully-populated context alike', async () => {
	const withoutClock: TurnContext = { ...baseCtx({ e2e4: {} }), clocks: null };
	assert.deepEqual(await chooseMove(withoutClock), ['e2e4']);
});

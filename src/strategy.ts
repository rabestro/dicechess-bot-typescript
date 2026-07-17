import type { MoveTree } from './client.js';

/**
 * Pick one complete legal turn from the prefix tree of UCI micro-moves. Each key is a
 * micro-move; a node with no children (`{}`) is a complete turn. This baseline walks a
 * uniformly random root-to-leaf path — replace it with your own strategy. Returns `[]`
 * for a forced pass (the server handles it and you submit nothing).
 *
 * Shared by both the poll-only bot (`bot.ts`) and the webhook handler (`webhook.ts`).
 */
export function chooseMove(legalMoves: MoveTree): string[] {
	const path: string[] = [];
	let node: MoveTree = legalMoves;
	while (Object.keys(node).length > 0) {
		const moves = Object.keys(node);
		const move = moves[Math.floor(Math.random() * moves.length)];
		path.push(move);
		node = node[move];
	}
	return path;
}

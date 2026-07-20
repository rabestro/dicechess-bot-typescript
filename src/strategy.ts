import type { Clocks, MoveTree } from './client.js';

/**
 * Everything a move-choosing strategy gets, from both connection modes alike (the poll bot
 * builds this from `BotClient.snapshot`; the webhook handler builds it from the delivered
 * envelope) — so a strategy written once runs unchanged in either.
 */
export interface TurnContext {
	/** DFEN of the position to move in — the 7th field is the pending dice pool as piece letters. */
	dfen: string;
	/** The prefix tree of legal UCI micro-moves for this roll (see `chooseMove`'s doc for how to read it). */
	legalMoves: MoveTree;
	/** Your seat. Always the seat to move — you are only ever asked on your own turn. */
	activeSeat: 'White' | 'Black';
	/** Remaining time per side, in milliseconds; `null` on `Unlimited` games. Budget your thinking
	 * against this — the platform is a synchronous request/response protocol, so "thinking longer"
	 * simply means this function takes longer to resolve. A webhook delivery is additionally capped
	 * by the server's own timeout (typically ~15s), whichever of the two is smaller. */
	clocks: Clocks | null;
}

/**
 * Pick one complete legal turn from `ctx.legalMoves` — a prefix tree of UCI micro-moves. Each key
 * is a micro-move; a node with no children (`{}`) is a complete turn. This baseline walks a
 * uniformly random root-to-leaf path, ignoring `dfen`/`clocks` entirely — replace it with your own
 * evaluation (of the position) and time management (of the clock). Returns `[]` for a forced pass
 * (the server handles it and you submit nothing).
 *
 * `async` on purpose: a real strategy will likely want to shell out to an engine, call a model, or
 * otherwise await something, and every caller already awaits this.
 *
 * Shared by both the poll-only bot (`bot.ts`) and the webhook handler (`webhook.ts`).
 */
export async function chooseMove(ctx: TurnContext): Promise<string[]> {
	const path: string[] = [];
	let node: MoveTree = ctx.legalMoves;
	while (Object.keys(node).length > 0) {
		const moves = Object.keys(node);
		const move = moves[Math.floor(Math.random() * moves.length)];
		path.push(move);
		node = node[move];
	}
	return path;
}

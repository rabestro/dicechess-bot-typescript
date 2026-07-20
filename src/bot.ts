#!/usr/bin/env node
/**
 * A complete, runnable Dice Chess bot — poll-only, zero runtime dependencies.
 *
 * It mints an anonymous identity, challenges the house sparring bot, and plays full
 * games by walking the legal-move tree the server publishes each turn. **You never
 * implement a single rule of the variant** — the legal moves arrive on the wire.
 *
 * Make it your own by editing `chooseMove` (the only decision the bot makes).
 *
 *   npm start                      # anonymous, vs house/greedy, forever
 *   DICECHESS_TOKEN=... npm start  # as a registered identity
 *
 * Environment overrides: DICECHESS_TOKEN, DICECHESS_BASE_URL, DICECHESS_OPPONENT
 * (`team/name`, default `house/greedy`), DICECHESS_NAME, DICECHESS_POLL_SECONDS.
 */

import { randomBytes } from 'node:crypto';
import { BotClient, DEFAULT_BASE_URL, type GameSummary } from './client.js';
import { chooseMove, type TurnContext } from './strategy.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function playTurn(client: BotClient, game: GameSummary, seeded: Set<string>): Promise<void> {
	const gameId = game.gameId;

	if (!seeded.has(gameId)) {
		try {
			await client.submitSeed(gameId, randomBytes(16).toString('hex'));
		} catch {
			/* seeding is best-effort */
		}
		seeded.add(gameId);
	}

	// One call gets dfen + clocks + the inline legal-move tree together; fall back to the
	// dedicated (never-capped) endpoint only if the tree was too large to inline (rare).
	const state = await client.snapshot(gameId);
	const tree = state.legalMoves ?? (await client.legalMoves(gameId));
	const ctx: TurnContext = { dfen: state.dfen, legalMoves: tree, activeSeat: state.activeSeat, clocks: state.clocks };

	const moves = await chooseMove(ctx);
	if (moves.length === 0) return; // forced pass — the server auto-passes

	const verdict = await client.submitMove(gameId, moves);
	if (verdict.applied) {
		console.info(`game ${gameId.slice(0, 8)}: played ${moves.join(' ')} (v${verdict.version})`);
	} else {
		console.info(`game ${gameId.slice(0, 8)}: move refused (${verdict.reason})`);
	}
}

async function main(): Promise<void> {
	const baseUrl = process.env.DICECHESS_BASE_URL ?? DEFAULT_BASE_URL;
	const token = process.env.DICECHESS_TOKEN;
	const opponent = process.env.DICECHESS_OPPONENT ?? 'house/greedy';
	const name = process.env.DICECHESS_NAME ?? 'typescript-starter';
	const pollMs = Number(process.env.DICECHESS_POLL_SECONDS ?? '3') * 1000;
	const [oppTeam, oppName] = opponent.split('/');

	const client = new BotClient({
		baseUrl,
		token,
		onUnauthorized: async (c) => {
			await c.mintAnon(name);
		},
	});
	if (!client.token) await client.mintAnon(name); // anonymous: perfect for trying things out

	const seeded = new Set<string>();
	console.info(`bot ready — challenging ${opponent} and playing forever (Ctrl-C to stop)`);

	for (;;) {
		try {
			const games = await client.myGames();
			if (games.length === 0) {
				// Activity loop: no live game → offer another challenge and wait for it.
				await client.challenge(oppTeam, oppName);
			} else {
				for (const game of games) {
					if (game.dicePending && game.activeSeat === game.seat) {
						await playTurn(client, game, seeded);
					}
				}
			}
		} catch (e) {
			console.warn(`loop error (continuing): ${(e as Error).message}`);
		}
		await sleep(pollMs);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

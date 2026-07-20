#!/usr/bin/env node
/**
 * Opt a registered bot into the rating ladder.
 *
 *   DICECHESS_TOKEN=<registered-token> npm run ladder:join
 *
 * From here it's passive: the server pairs on-ladder bots against each other on its own
 * (server-chosen, common-random-numbers mirror pairs). Your rating appears on the public
 * leaderboard (https://play-api.jc.id.lv/leaderboard) once it converges — typically a few
 * dozen games — and on your bot's profile (`/bots/{team}/{name}`) immediately, flagged
 * provisional. Leave any time with the mirror `/bot/ladder/leave` endpoint.
 */

import { BotClient, DEFAULT_BASE_URL } from './client.js';

const token = process.env.DICECHESS_TOKEN;
if (!token) {
	console.error("set DICECHESS_TOKEN to a registered bot's token (anon bots can't join the ladder)");
	process.exit(1);
}

const client = new BotClient({ baseUrl: process.env.DICECHESS_BASE_URL ?? DEFAULT_BASE_URL, token });
const result = await client.joinLadder();
console.info(`onLadder=${result.onLadder} glickoRating=${result.glickoRating} glickoRd=${result.glickoRd}`);

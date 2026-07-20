#!/usr/bin/env node
/**
 * Claim a durable bot identity and print its token.
 *
 *   npm run claim-identity -- <team> <name>
 *
 * This is the gateway to everything that needs a durable identity: the rating ladder
 * (`npm run ladder:join`) and webhooks (`npm run register --`). Both `team` and `name` are
 * lowercase slugs (`[a-z0-9][a-z0-9-]*`), first-come-first-served. The printed token is shown
 * exactly once — store it as DICECHESS_TOKEN.
 */

import { BotClient, DEFAULT_BASE_URL } from './client.js';

const [team, name] = process.argv.slice(2);
if (!team || !name) {
	console.error('usage: npm run claim-identity -- <team> <name>');
	process.exit(1);
}

const client = new BotClient({ baseUrl: process.env.DICECHESS_BASE_URL ?? DEFAULT_BASE_URL });
const result = await client.register(team, name);
console.info(`claimed ${result.id}`);
console.info(`DICECHESS_TOKEN=${result.token}`);

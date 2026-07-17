#!/usr/bin/env node
/**
 * Register a deployed webhook URL and print its signing secret.
 *
 *   DICECHESS_TOKEN=<registered-token> npm run register -- https://your-url/
 *
 * Webhooks are a registered-identity feature, so this needs a durable token (not an anonymous
 * one). The URL must already be serving the handler — the server performs an ownership handshake
 * against it during registration. The printed secret becomes the handler's DICECHESS_WEBHOOK_SECRET.
 */

import { BotClient, DEFAULT_BASE_URL } from './client.js';

const url = process.argv[2];
const token = process.env.DICECHESS_TOKEN;

if (!url) {
	console.error('usage: DICECHESS_TOKEN=<token> npm run register -- <https-url>');
	process.exit(1);
}
if (!token) {
	console.error("set DICECHESS_TOKEN to a registered bot's token (anon bots can't register webhooks)");
	process.exit(1);
}

const client = new BotClient({ baseUrl: process.env.DICECHESS_BASE_URL ?? DEFAULT_BASE_URL, token });
const result = await client.registerWebhook(url);
console.info(`registered ${result.url}`);
console.info(`DICECHESS_WEBHOOK_SECRET=${result.secret}`);

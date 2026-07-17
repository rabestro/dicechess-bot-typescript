#!/usr/bin/env node
/**
 * A serverless-style webhook bot — the push alternative to `bot.ts`'s poll loop.
 *
 * The server POSTs here when it is your turn, and the HTTP response body is your move. The
 * handler is stateless: it needs only the per-bot webhook secret (never a token), so it drops
 * straight into a cloud function.
 *
 *   1. Deploy at a public HTTPS URL, then register once (needs a REGISTERED token):
 *        DICECHESS_TOKEN=<token> npm run register -- https://your-url/
 *   2. Run with the printed secret:
 *        DICECHESS_WEBHOOK_SECRET=<secret> npm run webhook   # listens on :8080 (PORT to override)
 *
 * For a real cloud function, call `handleDelivery` from your platform's request handler — it is
 * pure and verifies the HMAC signature for you.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { handleDelivery } from './webhook.js';

const secret = process.env.DICECHESS_WEBHOOK_SECRET;
const port = Number(process.env.PORT ?? '8080');

if (!secret) {
	console.error('set DICECHESS_WEBHOOK_SECRET (printed by `npm run register`) before starting');
	process.exit(1);
}

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve) => {
		let data = '';
		req.on('data', (chunk) => (data += chunk));
		req.on('end', () => resolve(data));
	});
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
	if (req.method !== 'POST') {
		res.writeHead(405).end();
		return;
	}
	let result;
	try {
		const raw = await readBody(req);
		result = await handleDelivery(req.headers as Record<string, string | undefined>, raw, secret!);
	} catch (e) {
		// Never 500 the server — let the clock decide, exactly like a polling bot going quiet.
		console.warn(`delivery error: ${(e as Error).message}`);
		result = { status: 400, body: { error: 'bad request' } };
	}
	const body = JSON.stringify(result.body);
	res.writeHead(result.status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
	res.end(body);
});

server.listen(port, () => console.info(`webhook handler listening on :${port}`));

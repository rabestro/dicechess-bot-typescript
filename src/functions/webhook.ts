/**
 * Azure Functions (v4 programming model) adapter for the Dice Chess webhook.
 *
 * This is a thin wrapper — all the actual logic (signature verification, move selection,
 * the ownership-handshake nonce echo) lives in `../webhook.ts` and is identical to the
 * plain Node.js server in `../webhook-server.ts`. Deploy this and the server treats your
 * Function App exactly like any other webhook: one HTTPS POST per turn.
 *
 * Route: POST https://<your-app>.azurewebsites.net/api/webhook
 *
 * `authLevel: 'anonymous'` is deliberate, not an oversight: the Dice Chess server has no way
 * to present an Azure function key, so Azure-level auth would only block the one caller that
 * needs to reach this endpoint. The HMAC signature (`handleDelivery`) is the real
 * authentication — the same trust model the platform's docs describe. If you want a second,
 * redundant layer anyway, switch to `authLevel: 'function'` and register the URL with the key
 * embedded as a query string, e.g. `.../api/webhook?code=<function-key>` (the server treats
 * the registered URL as opaque and re-posts to it verbatim).
 *
 * See ../../AZURE.md for the full deploy walkthrough.
 */

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { handleDelivery } from '../webhook.js';

app.http('webhook', {
	methods: ['POST'],
	authLevel: 'anonymous',
	handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
		const rawBody = await request.text();
		const headers: Record<string, string | undefined> = {};
		request.headers.forEach((value, key) => {
			headers[key.toLowerCase()] = value;
		});

		// Read at call time (not module load time) so a just-updated App Setting takes effect
		// on the next invocation without redeploying. Empty is valid: the ownership-handshake
		// branch of handleDelivery never checks the secret, so registration works even before
		// this setting exists — see AZURE.md's deploy-then-register-then-configure order.
		const secret = process.env.DICECHESS_WEBHOOK_SECRET ?? '';
		if (!secret) {
			context.warn('DICECHESS_WEBHOOK_SECRET is not set — only the verification handshake will succeed');
		}

		try {
			const { status, body } = await handleDelivery(headers, rawBody, secret);
			return { status, jsonBody: body };
		} catch (e) {
			context.warn(`delivery error: ${(e as Error).message}`);
			return { status: 400, jsonBody: { error: 'bad request' } };
		}
	},
});

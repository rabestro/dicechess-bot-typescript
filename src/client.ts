/**
 * Thin, dependency-free transport client for the Dice Chess Bot API.
 *
 * Uses the built-in `fetch` (Node 18+) — no runtime dependencies. It wraps auth, the
 * REST endpoints, and the resilience patterns a real bot needs (retry with backoff,
 * `Retry-After` handling, and a hook to refresh the token on `401`). Game logic stays
 * out of here: your bot picks moves; this client just moves bytes.
 *
 * Full API reference: https://rabestro.github.io/dicechess-play-api/
 */

export const DEFAULT_BASE_URL = 'https://play-api.jc.id.lv';

// A descriptive User-Agent. The platform sits behind a CDN whose default bot rules
// reject unidentified clients (Cloudflare error 1010), so every request identifies itself.
const USER_AGENT = 'dicechess-bot-typescript/1.0 (+https://github.com/rabestro/dicechess-bot-typescript)';

/** A prefix tree of UCI micro-moves; a leaf (`{}`) is a complete legal turn. */
export interface MoveTree {
	[move: string]: MoveTree;
}

export interface GameSummary {
	gameId: string;
	seat: 'White' | 'Black';
	activeSeat: 'White' | 'Black';
	dicePending: boolean;
	version: number;
}

export interface MoveVerdict {
	applied: boolean;
	version: number | null;
	reason: string | null;
}

/** A non-retryable HTTP error (4xx other than 401/429). */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly body: string,
	) {
		super(`HTTP ${status}: ${body}`);
		this.name = 'ApiError';
	}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface BotClientOptions {
	baseUrl?: string;
	token?: string;
	/** Called when a request gets 401 so a bot can refresh its token. */
	onUnauthorized?: (client: BotClient) => Promise<void>;
	maxRetries?: number;
}

export class BotClient {
	private readonly baseUrl: string;
	token?: string;
	private readonly maxRetries: number;
	private readonly onUnauthorized?: (client: BotClient) => Promise<void>;

	constructor(opts: BotClientOptions = {}) {
		this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
		this.token = opts.token;
		this.maxRetries = opts.maxRetries ?? 5;
		this.onUnauthorized = opts.onUnauthorized;
	}

	// ── identity ─────────────────────────────────────────────────────────────

	async mintAnon(name?: string): Promise<Record<string, unknown>> {
		const query = name ? `?name=${encodeURIComponent(name)}` : '';
		const data = await this.request('POST', `/bot/anon${query}`, undefined, false);
		this.token = data.token as string;
		console.info(`minted anonymous identity ${data.id}`);
		return data;
	}

	account(): Promise<Record<string, unknown>> {
		return this.request('GET', '/bot/account');
	}

	// ── challenges & games ────────────────────────────────────────────────────

	challenge(team: string, name: string, timeControl: unknown = { Unlimited: {} }): Promise<unknown> {
		return this.request('POST', '/bot/challenge', { team, name, timeControl });
	}

	async myGames(): Promise<GameSummary[]> {
		const data = await this.request('GET', '/bot/games');
		return (data.games as GameSummary[]) ?? [];
	}

	async legalMoves(gameId: string): Promise<MoveTree> {
		const data = await this.request('GET', `/games/${gameId}/moves`, undefined, false);
		return ((data.legalMoves as MoveTree) ?? {}) as MoveTree;
	}

	snapshot(gameId: string): Promise<Record<string, unknown>> {
		return this.request('GET', `/games/${gameId}`, undefined, false);
	}

	async submitSeed(gameId: string, seed: string): Promise<void> {
		await this.request('POST', `/bot/game/${gameId}/seed`, { seed });
	}

	submitMove(gameId: string, moves: string[]): Promise<MoveVerdict> {
		return this.request('POST', `/bot/game/${gameId}/move`, { moves }) as Promise<MoveVerdict>;
	}

	async resign(gameId: string): Promise<void> {
		await this.request('POST', `/bot/game/${gameId}/resign`);
	}

	// ── transport ──────────────────────────────────────────────────────────────

	private async request(method: string, path: string, body?: unknown, auth = true): Promise<any> {
		const url = `${this.baseUrl}${path}`;
		for (let attempt = 1; ; attempt++) {
			const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
			if (body !== undefined) headers['Content-Type'] = 'application/json';
			if (auth && this.token) headers['Authorization'] = `Bearer ${this.token}`;

			let res: Response;
			try {
				res = await fetch(url, {
					method,
					headers,
					body: body !== undefined ? JSON.stringify(body) : undefined,
				});
			} catch (e) {
				if (attempt <= this.maxRetries) {
					await sleep(BotClient.backoff(attempt));
					continue;
				}
				throw e;
			}

			if (res.ok) {
				const text = await res.text();
				return text ? JSON.parse(text) : {};
			}

			const detail = await res.text();
			if (res.status === 401 && this.onUnauthorized && attempt <= this.maxRetries) {
				console.warn('401 Unauthorized — refreshing token');
				await this.onUnauthorized(this);
				continue;
			}
			if (res.status === 429 && attempt <= this.maxRetries) {
				const retryAfter = Number(res.headers.get('Retry-After')) * 1000 || BotClient.backoff(attempt);
				console.warn(`429 Too Many Requests — retrying in ${retryAfter}ms`);
				await sleep(retryAfter);
				continue;
			}
			if (res.status >= 500 && res.status < 600 && attempt <= this.maxRetries) {
				console.warn(`HTTP ${res.status} — retrying`);
				await sleep(BotClient.backoff(attempt));
				continue;
			}
			throw new ApiError(res.status, detail);
		}
	}

	/** Exponential backoff capped at 30s: 1, 2, 4, 8, 16, 30, 30 … (ms). */
	private static backoff(attempt: number): number {
		return Math.min(2 ** (attempt - 1) * 1000, 30_000);
	}
}

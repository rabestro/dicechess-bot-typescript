# Dice Chess bot — TypeScript starter

A complete, **runnable** Dice Chess bot in TypeScript with **zero runtime
dependencies** (built-in `fetch`). It mints an anonymous identity, challenges the
house sparring bot, and plays full games by walking the legal-move tree the server
sends each turn — so **you never implement a single rule of the variant.**

MIT-licensed: copy it into a closed-source bot with no strings attached. Playing
over the wire imposes no obligation, and this starter links no engine — see
[Licensing for Bots](https://rabestro.github.io/dicechess-play-api/licensing/).

## Quickstart

[**Use this template**](https://github.com/rabestro/dicechess-bot-typescript/generate) → clone your copy → run:

```bash
npm install
npm start
```

That's it. No signup — it mints an anonymous token and starts playing `house/greedy`
immediately:

```
minted anonymous identity bot:team:anon:typescript-starter-…
game 147ea30e: played g1h3 (v3)
```

Requires Node 18+ (for built-in `fetch`).

## Make it yours

The only decision the bot makes is in **`chooseMove`** (`src/strategy.ts`) — the baseline
ignores the position entirely and walks a random root-to-leaf path of the legal-move tree.
Replace it with real evaluation and time management; everything else (auth, discovery, the
activity loop, retries) is transport you can leave alone. Both the poll bot and the webhook
handler build the same `TurnContext` and share this one function.

```ts
interface TurnContext {
  dfen: string;               // the position to move in (7th field = the pending dice pool)
  legalMoves: MoveTree;        // a prefix tree of UCI micro-moves; a leaf ({}) is a full turn
  activeSeat: 'White' | 'Black'; // your seat — always the seat to move
  clocks: { white: number; black: number } | null; // remaining ms per side; null on Unlimited
}

async function chooseMove(ctx: TurnContext): Promise<string[]> {
  // Return the move path you want to play, or [] for a forced pass. `async` because a real
  // strategy will likely await an engine or a model — every caller already awaits this.
}
```

## Going further

- **A durable identity** (survives restarts; the gateway to the ladder and webhooks):
  ```bash
  npm run claim-identity -- <team> <name>   # prints DICECHESS_TOKEN=…, shown once
  ```
  See [Authentication & Identity](https://rabestro.github.io/dicechess-play-api/authentication/).
- **Join the rating ladder** (passive — the server pairs you against other on-ladder bots and
  your rating appears on the public [leaderboard](https://play-api.jc.id.lv/leaderboard) once
  it converges):
  ```bash
  DICECHESS_TOKEN=<token> npm run ladder:join
  ```
- **Environment overrides:** `DICECHESS_TOKEN`, `DICECHESS_BASE_URL`,
  `DICECHESS_OPPONENT` (`team/name`, default `house/greedy`), `DICECHESS_NAME`,
  `DICECHESS_POLL_SECONDS`.
- **Scripts:** `npm start` (run), `npm run typecheck`, `npm run build`, `npm test`.
- **The full API:** <https://rabestro.github.io/dicechess-play-api/> — REST reference,
  event streams, webhooks, and the provably-fair dice verification procedure.
- **[Play against it yourself](https://rabestro.github.io/dicechess-play-api/play-your-bot/)**
  from the public lobby, before joining the ladder — confirms it plays a legal game end to end.

## Serverless: webhook mode

Instead of polling, you can run as a **webhook**: register one HTTPS callback and the server
POSTs when it's your turn — your HTTP response body is the move. The handler is stateless (it
needs only the signing secret, never a token), so it drops into a cloud function.

```bash
# 1. Deploy the handler at a public HTTPS URL, then register it (needs a REGISTERED token):
DICECHESS_TOKEN=<registered-token> npm run register -- https://your-url/
#    → prints DICECHESS_WEBHOOK_SECRET=…

# 2. Run the handler with that secret:
DICECHESS_WEBHOOK_SECRET=<secret> npm run webhook
```

For local testing, expose it with a tunnel (`cloudflared tunnel --url http://localhost:8080`)
and register the tunnel URL. To deploy to AWS Lambda / Cloudflare Workers, call `handleDelivery`
(`src/webhook.ts`) from your platform's request handler — it is pure and verifies the HMAC
signature for you, then builds the same `TurnContext` as the poll bot (position, legal moves,
your seat, clocks) and calls the same `chooseMove`. Webhooks are a
[registered-identity](https://rabestro.github.io/dicechess-play-api/authentication/) feature and
must be enabled on the server. Full contract: [Webhooks](https://rabestro.github.io/dicechess-play-api/reference/webhooks/).

### Azure Functions (ready-made adapter)

`src/functions/webhook.ts` wraps `handleDelivery` in the Azure Functions v4 programming
model — no adapter code to write. **[See `AZURE.md`](./AZURE.md) for the full walkthrough**:
create the Function App, deploy, register, and join the ladder, end to end.

## What's inside

| File | Role |
| --- | --- |
| `src/bot.ts` | The runnable poll-only bot; picks moves via `chooseMove`. |
| `src/strategy.ts` | `TurnContext` + `chooseMove` — the one decision the bot makes. **Edit this** (shared by both modes). |
| `src/client.ts` | Thin transport client: auth, REST calls, retry/backoff, `Retry-After`, 401 re-mint. |
| `src/webhook-server.ts` · `src/register.ts` | Plain Node.js webhook handler and one-time registration helper. |
| `src/functions/webhook.ts` | Azure Functions v4 adapter — same logic, Azure's request/response shape. See `AZURE.md`. |
| `src/webhook.ts` | Pure delivery logic: HMAC verification + move selection (reuse it in any function runtime). |
| `src/claim-identity.ts` · `src/join-ladder.ts` | Claim a durable identity, then opt into the rating ladder. |

## Connection modes

This starter uses **polling** — the simplest mode, ideal for a cron/serverless
function. For low-latency play use the ndjson **event streams**, or for pure
serverless register a **webhook** (the server POSTs your turns). Both are
documented under [Connection Modes](https://rabestro.github.io/dicechess-play-api/connection-modes/).

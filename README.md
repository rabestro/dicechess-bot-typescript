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
walks a random root-to-leaf path of the legal-move tree. Replace it with your
strategy; everything else (auth, discovery, the activity loop, retries) is transport
you can leave alone. Both the poll bot and the webhook handler share it.

```ts
function chooseMove(legalMoves: MoveTree): string[] {
  // legalMoves is a prefix tree of UCI micro-moves; a leaf ({}) is a full turn.
  // Return the path you want to play, or [] for a forced pass.
}
```

## Going further

- **A durable identity** (survives restarts, joins the rating ladder): set
  `DICECHESS_TOKEN` to a registered token instead of minting anonymously. See
  [Authentication & Identity](https://rabestro.github.io/dicechess-play-api/authentication/).
- **Environment overrides:** `DICECHESS_TOKEN`, `DICECHESS_BASE_URL`,
  `DICECHESS_OPPONENT` (`team/name`, default `house/greedy`), `DICECHESS_NAME`,
  `DICECHESS_POLL_SECONDS`.
- **Scripts:** `npm start` (run), `npm run typecheck`, `npm run build`.
- **The full API:** <https://rabestro.github.io/dicechess-play-api/> — REST reference,
  event streams, webhooks, and the provably-fair dice verification procedure.

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
and register the tunnel URL. To deploy to AWS Lambda / Cloudflare Workers / Azure Functions,
call `handleDelivery` (`src/webhook.ts`) from your platform's request handler — it is pure and
verifies the HMAC signature for you. Same `chooseMove` as the poll bot. Webhooks are a
[registered-identity](https://rabestro.github.io/dicechess-play-api/authentication/) feature and
must be enabled on the server. Full contract: [Webhooks](https://rabestro.github.io/dicechess-play-api/reference/webhooks/).

## What's inside

| File | Role |
| --- | --- |
| `src/bot.ts` | The runnable poll-only bot; picks moves via `chooseMove`. |
| `src/strategy.ts` | `chooseMove` — the one decision the bot makes. **Edit this** (shared by both modes). |
| `src/client.ts` | Thin transport client: auth, REST calls, retry/backoff, `Retry-After`, 401 re-mint. |
| `src/webhook-server.ts` · `src/register.ts` | Serverless webhook handler and one-time registration helper. |
| `src/webhook.ts` | Pure delivery logic: HMAC verification + move selection (reuse it in any function runtime). |

## Connection modes

This starter uses **polling** — the simplest mode, ideal for a cron/serverless
function. For low-latency play use the ndjson **event streams**, or for pure
serverless register a **webhook** (the server POSTs your turns). Both are
documented under [Connection Modes](https://rabestro.github.io/dicechess-play-api/connection-modes/).

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

The only decision the bot makes is in **`chooseMove`** (`src/bot.ts`) — the baseline
walks a random root-to-leaf path of the legal-move tree. Replace it with your
strategy; everything else (auth, discovery, the activity loop, retries) is transport
you can leave alone.

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

## What's inside

| File | Role |
| --- | --- |
| `src/bot.ts` | The runnable poll-only bot and its `chooseMove` — **edit this**. |
| `src/client.ts` | Thin transport client: auth, REST calls, retry/backoff, `Retry-After`, 401 re-mint. |

## Connection modes

This starter uses **polling** — the simplest mode, ideal for a cron/serverless
function. For low-latency play use the ndjson **event streams**, or for pure
serverless register a **webhook** (the server POSTs your turns). Both are
documented under [Connection Modes](https://rabestro.github.io/dicechess-play-api/connection-modes/).

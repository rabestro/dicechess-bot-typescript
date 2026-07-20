# Deploying to Azure Functions

This turns the starter into a pure serverless bot: Azure invokes `src/functions/webhook.ts`
only when it's your turn, and your response body is the move. No server to keep running,
no timer to schedule.

The end state: a bot that opts into the [rating ladder](https://rabestro.github.io/dicechess-play-api/authentication/#joining-the-rating-ladder),
gets automatically paired against other on-ladder bots, and shows up on the public
[leaderboard](https://play-api.jc.id.lv/leaderboard) once its rating converges (usually a
few dozen games) — with no server of your own to operate in the meantime.

## Prerequisites

- An Azure subscription.
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az`), logged in (`az login`).
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) (`func`).
- Node 18+ locally (for `npm install` / `npm run build`).

## 1. Create the Azure resources (one-time)

Pick a globally-unique Function App name (it becomes part of your hostname) and a storage
account name (lowercase alphanumeric only, 3–24 chars, also globally unique):

```bash
RG=dicechess-bot-rg
LOCATION=eastus
STORAGE=dicechessbotsa$RANDOM      # must be globally unique
APP=dicechess-bot-$RANDOM          # must be globally unique

az group create --name "$RG" --location "$LOCATION"

az storage account create \
  --name "$STORAGE" --location "$LOCATION" \
  --resource-group "$RG" --sku Standard_LRS

az functionapp create \
  --resource-group "$RG" \
  --consumption-plan-location "$LOCATION" \
  --runtime node --runtime-version 20 --functions-version 4 \
  --name "$APP" --storage-account "$STORAGE" --os-type Linux
```

Your function's eventual URL: `https://$APP.azurewebsites.net/api/webhook`.

## 2. Deploy the code

From the repo root (`func` detects the TypeScript project and triggers a remote build —
Azure runs `npm install` and `npm run build` for you; nothing needs to be pre-built locally):

```bash
npm install       # local install, so `npm run build`/typecheck still work for you locally
func azure functionapp publish "$APP"
```

At this point the function is **live** — but `DICECHESS_WEBHOOK_SECRET` isn't set yet. That's
fine: the ownership-handshake request the play platform sends during registration doesn't need
it (see `src/functions/webhook.ts`'s doc comment for why).

## 3. Claim a durable bot identity

Webhooks and the ladder both need a **registered** (not anonymous) identity:

```bash
npm run claim-identity -- <your-team> <your-bot-name>
#  → claimed bot:team:<your-team>:<your-bot-name>
#  → DICECHESS_TOKEN=<token>              ← save this, shown once
```

## 4. Register the webhook

```bash
DICECHESS_TOKEN=<token-from-step-3> npm run register -- "https://$APP.azurewebsites.net/api/webhook"
#  → registered https://<app>.azurewebsites.net/api/webhook
#  → DICECHESS_WEBHOOK_SECRET=<secret>    ← save this, shown once
```

This only succeeds if step 2's deployment is already live — the server POSTs a verification
nonce to the URL right now and expects it echoed back.

## 5. Configure the secret and let the app restart

```bash
az functionapp config appsettings set \
  --name "$APP" --resource-group "$RG" \
  --settings DICECHESS_WEBHOOK_SECRET=<secret-from-step-4>
```

Azure restarts the app automatically when settings change (a few seconds). From now on every
delivery is HMAC-verified.

## 6. Join the ladder

```bash
DICECHESS_TOKEN=<token-from-step-3> npm run ladder:join
#  → onLadder=true glickoRating=1500 glickoRd=350
```

That's it — passive from here. The scheduler pairs your bot against other on-ladder bots on
its own schedule (Fischer 300+3 time control); your webhook answers the turns. Watch progress
on your bot's profile (`https://play-api.jc.id.lv/bots/<team>/<name>`, marked `provisional`
until the rating converges) and then on the public
[leaderboard](https://play-api.jc.id.lv/leaderboard).

## Operational notes

- **Cold starts.** On the Consumption plan, a function that hasn't been invoked recently takes
  a few seconds to wake up — typically 1–4 s for a bundle this small. That is normally fine:
  the server waits `min(its configured cap — usually ~15 s, your remaining clock)` for the
  answer, so a cold start well inside that window just costs those seconds of clock, and the
  Fischer increment credits time back on every completed turn. During a game the function stays
  warm (one delivery per turn), so expect roughly one cold start per game, on the first move.
  The case to watch is an answer that blows past the window entirely: delivery is
  **single-attempt** — the same roll is never redelivered — so that game will eventually be
  lost on time, exactly like a polling bot that stopped polling. If the logs ever show that,
  add a keep-warm ping or move to a Premium plan with an Always Ready instance.
- **Logs.** `az functionapp log tail --name "$APP" --resource-group "$RG"` or the "Live Metrics" /
  "Log stream" panel in the Azure Portal.
- **Redeploying.** Just re-run `func azure functionapp publish "$APP"` after code changes —
  the registered webhook URL doesn't change, so nothing needs re-registering.
- **Removing.** `az group delete --name "$RG"` tears down everything created in step 1. Leave
  the ladder first (`POST /bot/ladder/leave`) if you want your rating frozen rather than the
  identity simply going quiet.

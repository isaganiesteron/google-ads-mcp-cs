# T-066: wire change-log write into this Worker's 19 mutating tools

**Start a Claude Code session rooted in this repo (`E:\google-ads-mcp-cs`) and hand it this file.** Everything needed to implement, test, and go live is below.

## Context (why this exists)

This Worker (Cloudflare, deployed as `google-ads-mcp`) shares the same Google Ads OAuth credentials as the main `contractor-scale-os` codebase's discovery-loop/Paperclip write path, but until now it logged nothing when it mutated a live account — a blind spot the main codebase's `google_ads_change_log` review system (dashboard, Class A/B/C policy, ClickUp review tasks) never saw. T-066 / TH-020 in `contractor-scale-os/tasks/` closes that gap.

**Current safety state (as of commit `939671f`, 2026-07-28):** every one of this Worker's 19 mutating tools is already gated behind a `MUTATIONS_ENABLED = false` flag (`src/index.ts:60`) that returns an error instead of touching the Google Ads API. **No live mutations are happening right now.** The comment on that flag says exactly what this session needs to do: *"Set to true once mutation logging (T-066) is implemented."* Flipping it to `true` is the explicit go-live step at the end of this work — do not flip it until logging is wired and verified end-to-end.

The other side of this (api-server) is **done and live**: `POST /api/google-ads-change-log` shipped to `contractor-scale-api` on Render 2026-07-29, smoke-tested locally and in production (7/7 pass). The secret this Worker needs is already provisioned and synced here via Doppler → GitHub Actions → Cloudflare — see "What's already in place" below.

## The endpoint contract (already live, do not modify from this repo)

```
POST https://contractor-scale-api.onrender.com/api/google-ads-change-log
Headers:
  Content-Type: application/json
  X-API-Key: <GOOGLE_ADS_CHANGE_LOG_API_KEY>
```

Request body:

| Field | Required | Notes |
|---|---|---|
| `customer_id` | yes | Google Ads customer ID, dashes optional (API strips them) |
| `change_type` | yes | free-text label — recommend using the MCP tool name, e.g. `mutate_campaign_budgets` |
| `applied_by` | yes | recommend the fixed string `mcp:google-ads-mcp-cs` |
| `reason` | yes | DB-level NOT NULL constraint on agent-source rows — see "Design decisions" below for what to send |
| `campaign_id` | no | string or null |
| `entity_id` | no | string or null |
| `before_value` | no | any JSON, or null |
| `after_value` | no | any JSON, or null |
| `status` | no | `"applied"` (default) or `"failed"` |
| `policy_class` | no | `A`/`B`/`C` if you have one to send — not applicable here, omit |
| `issue_ref` / `external_ref` | no | omit unless useful |

`source` is **not** accepted from the caller — the API hardcodes it to `'agent'` server-side (the only value besides `'human'` that the DB's live check constraint allows).

Responses: `201` + the inserted row on success. `400` with `{success:false, error: "..."}` for missing/invalid fields. `401` for a missing/wrong API key. `503` if the DB isn't configured (shouldn't happen in prod).

## What's already in place (nothing to do here)

- `GOOGLE_ADS_CHANGE_LOG_API_KEY` is set in Doppler (`cs-shared`/`prd`), synced to Render (api-server) and to **this Worker** via the `contractor-scale-os` repo's `sync-doppler-to-cloudflare-worker.js` allowlist (fixed there 2026-07-29 — the `google-ads-mcp` target's key list didn't include it until then). Confirmed live via `wrangler secret list --name google-ads-mcp` — it's already sitting in this Worker's secrets, ready to read as `env.GOOGLE_ADS_CHANGE_LOG_API_KEY`.
- You do **not** need to provision or sync this key yourself. If a future rotation is needed, that happens in Doppler + the sync script in `contractor-scale-os`, not here.

## What you need to add in this repo

### 1. Env typing

`worker-configuration.d.ts` is manually maintained here (not gitignored) — add the new field to `interface Env` (inside the `declare namespace Cloudflare` block) alongside the existing `GOOGLE_ADS_*` keys:

```ts
GOOGLE_ADS_CHANGE_LOG_API_KEY?: string;
```

Optional (`?`) so local dev without the key doesn't break type-checking — the log helper should no-op with a console warning if it's unset (see below), not throw.

### 2. The api-server base URL

Not a secret — just hardcode it as a const near the top of `src/index.ts`, no new env var, no wrangler.jsonc/type changes needed for it:

```ts
const CHANGE_LOG_API_BASE_URL = 'https://contractor-scale-api.onrender.com';
```

### 3. A `logChange()` helper

Add near the other shared helpers (`getCredentials`, `missingCredentials`, around `src/index.ts:68-88`):

```ts
async function logChange(
	env: Env,
	entry: {
		customer_id: string;
		change_type: string;
		campaign_id?: string | null;
		entity_id?: string | null;
		before_value?: unknown;
		after_value?: unknown;
		reason: string;
		status?: 'applied' | 'failed';
	}
): Promise<void> {
	if (!env.GOOGLE_ADS_CHANGE_LOG_API_KEY) {
		console.warn('[change-log] GOOGLE_ADS_CHANGE_LOG_API_KEY not set — skipping log write');
		return;
	}
	try {
		const res = await fetch(`${CHANGE_LOG_API_BASE_URL}/api/google-ads-change-log`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': env.GOOGLE_ADS_CHANGE_LOG_API_KEY,
			},
			body: JSON.stringify({
				applied_by: 'mcp:google-ads-mcp-cs',
				status: 'applied',
				...entry,
			}),
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			console.error(`[change-log] write failed: ${res.status} ${text.slice(0, 300)}`);
		}
	} catch (e) {
		console.error('[change-log] write threw:', e instanceof Error ? e.message : String(e));
	}
}
```

**Design decision — non-blocking, best-effort logging.** This must never break the actual Google Ads mutation from returning to the caller. `logChange()` swallows all its own errors (network failure, api-server down, bad response) and only `console.error`s them — it never throws. Call it `await`ed, right after a successful mutation and before `return successResult(result)`. This repo's `Tool.handler` signature (`src/index.ts:47`) doesn't receive an `ExecutionContext`, so there's no `ctx.waitUntil()` available without threading `ctx` through all 19 handlers — not worth it for a v1. Awaiting a best-effort call adds one HTTP round-trip of latency to mutating tool calls, which is an acceptable trade for correctness here.

**Design decision — `reason` is not caller-supplied.** None of the 19 tool input schemas currently take a `reason` parameter, and the discovery-loop's equivalent CLI (`google-ads-mutate.js`) requires `--reason=` for a *human* audit trail — that doesn't map cleanly onto a programmatic MCP call. Default it to an auto-generated string identifying the tool, e.g. `` `google-ads-mcp-cs: ${changeType}` ``. Don't add a `reason` input param to every tool's schema for this — out of scope for v1.

**Design decision — skip logging on `validate_only: true`.** Several tools accept `validate_only` (dry-run against Google's validation, nothing actually applied). Don't log those — they'd misrepresent a no-op as an applied change.

**Open question — `entity_id`/`campaign_id` granularity.** A single tool call can bundle multiple operations across different entities (that's the whole point of `mutate_resources` and bulk arrays elsewhere). For v1, log **one row per tool call**, put the full `operations` array + the mutate result in `after_value`, and leave `entity_id`/`campaign_id` `null` unless there's an obvious single value to extract (e.g. `args.customer_id` is always available; a per-operation entity id usually isn't, cleanly). Splitting into one row per operation is a reasonable v2 if the review UI needs that granularity — don't build it now unless asked.

### 4. Wire it into the 15 tools that share `handleMutate()`

`handleMutate(env, resource, args)` at `src/index.ts:111` is the single choke point for 15 of the 19 mutating tools. Add a `changeType` param and log inside it, once:

```ts
async function handleMutate(
	env: Env,
	resource: string,
	args: Record<string, unknown>,
	changeType: string
): Promise<ToolResult> {
	if (!MUTATIONS_ENABLED) return mutationsDisabledResult();
	const customer_id = args.customer_id as string;
	const login_customer_id = args.login_customer_id as string | undefined;
	const partial_failure = args.partial_failure !== false;
	const validate_only = args.validate_only === true;

	if (!customer_id) return errorResult('customer_id is required');
	if (!args.operations) return errorResult('operations is required');

	const parsed = parseOperations(args.operations);
	if ('error' in parsed) return errorResult(parsed.error);

	const creds = getCredentials(env, login_customer_id);
	const missing = missingCredentials(creds);
	if (missing.length > 0) return errorResult(`Missing required credentials: ${missing.join(', ')}`);

	try {
		const result = await executeGoogleAdsMutate(creds, customer_id, resource, parsed.ops, login_customer_id, partial_failure, validate_only);
		if (!validate_only) {
			await logChange(env, {
				customer_id,
				change_type: changeType,
				after_value: { operations: parsed.ops, result },
				reason: `google-ads-mcp-cs: ${changeType}`,
			});
		}
		return successResult(result);
	} catch (e) {
		return errorResult(e instanceof Error ? e.message : String(e));
	}
}
```

Then update each of the 15 call sites to pass the tool name through (they're one-liners — just add the 4th arg):

| Line (as of `939671f`) | Tool name | Current call |
|---|---|---|
| 512 | `mutate_campaign_budgets` | `handleMutate(env, 'campaignBudgets', args)` |
| 539 | `mutate_campaigns` | `handleMutate(env, 'campaigns', args)` |
| 564 | `mutate_ad_groups` | `handleMutate(env, 'adGroups', args)` |
| 590 | `mutate_ads` | `handleMutate(env, 'adGroupAds', args)` |
| 618 | `mutate_keywords` | `handleMutate(env, 'adGroupCriteria', args)` |
| 646 | `mutate_campaign_criteria` | `handleMutate(env, 'campaignCriteria', args)` |
| 671 | `mutate_bidding_strategies` | `handleMutate(env, 'biddingStrategies', args)` |
| 696 | `mutate_ad_group_bid_modifiers` | `handleMutate(env, 'adGroupBidModifiers', args)` |
| 722 | `mutate_assets` | `handleMutate(env, 'assets', args)` |
| 748 | `mutate_campaign_assets` | `handleMutate(env, 'campaignAssets', args)` |
| 775 | `mutate_conversion_actions` | `handleMutate(env, 'conversionActions', args)` |
| 846 | `mutate_user_lists` | `handleMutate(env, 'userLists', args)` |
| 962 | `mutate_shared_sets` | `handleMutate(env, 'sharedSets', args)` |
| 986 | `mutate_shared_set_criteria` | `handleMutate(env, 'sharedCriteria', args)` |
| 1010 | `mutate_campaign_shared_sets` | `handleMutate(env, 'campaignSharedSets', args)` |

E.g. line 512 becomes: `handler: (args, env) => handleMutate(env, 'campaignBudgets', args, 'mutate_campaign_budgets'),`

Line numbers will drift once you start editing — re-grep `handler:.*=>\s*handleMutate\(env,` to re-find them if needed.

### 5. Wire the 4 tools with their own inline handler

These don't go through `handleMutate` — add the same `logChange()` call directly in each, right before their `return successResult(result)`:

- **`upload_click_conversions`** (`src/index.ts:779`, handler body ~799-822) — calls `uploadClickConversions()`. Log with `change_type: 'upload_click_conversions'`, `after_value: result`.
- **`apply_recommendations`** (`src/index.ts:852`, handler ~872-893) — calls `applyRecommendations()`. Log with `change_type: 'apply_recommendations'`, `after_value: result`.
- **`dismiss_recommendations`** (`src/index.ts:897`, handler ~915-936) — calls `dismissRecommendations()`.
- **`mutate_resources`** (`src/index.ts:1014`, handler ~1035+) — calls `executeUnifiedMutate()`. Log with `change_type: 'mutate_resources'`, `after_value: { operations: parsed.ops, result }`.

**Recommendation on `dismiss_recommendations`:** the original TH-020 scoping in `contractor-scale-os` leaned toward excluding it from logging (it doesn't change ad account state, just Google's recommendation-tracking list). But it's already gated behind `MUTATIONS_ENABLED` alongside the 18 real mutating tools (per commit `939671f`, "Disable all 19 mutating tools"), and the marginal cost of one more `logChange()` call is trivial. **Recommend including it** for a complete audit trail rather than a partial one — but this is a judgment call, not a hard requirement; exclude it if you'd rather match the original scoping exactly.

Note the actual verified count is **19 mutating tools**, not the "17" in the original TH-020 scoping note in `contractor-scale-os/tasks/THREADS.md` — that note underscoped by 2 (missed `mutate_resources` and `apply_recommendations`, or miscounted; not worth chasing why). Trust this file's count (verified directly against `src/index.ts` via every `if (!MUTATIONS_ENABLED)` call site) over the older note.

## Testing before go-live

1. Temporarily flip `MUTATIONS_ENABLED = true` **in local dev only** (`.dev.vars` / `wrangler dev`), never commit that flip yet.
2. Run one real (or sandbox account, if available) mutation through each of a few representative tools — at minimum one that goes through `handleMutate` (e.g. `mutate_campaign_budgets`) and all 4 custom handlers.
3. After each, confirm a row landed in `google_ads_change_log` with `applied_by = 'mcp:google-ads-mcp-cs'`, correct `change_type`, and a non-null `reason`. Quickest check: query Supabase directly, or hit `GET https://contractor-scale-api.onrender.com/api/google-ads-change-log?customerId=<id>` with a `DASHBOARD_API_KEY` (ask Isagani — don't provision your own).
4. Confirm a deliberately-broken call (bad `GOOGLE_ADS_CHANGE_LOG_API_KEY`, or point `CHANGE_LOG_API_BASE_URL` at a dead host temporarily) still returns the normal tool success result — proving the non-blocking/best-effort design actually holds.
5. Only once all of the above passes: commit, deploy (`wrangler deploy`), then flip `MUTATIONS_ENABLED = true` for real, deploy again, and tell Isagani so `contractor-scale-os/tasks/THREADS.md` (TH-020) and `TODO.md` (T-066) can be marked done.

## Don't

- Don't give this Worker direct Supabase credentials — that was explicitly rejected in the TH-020 design discussion; always go through the api-server endpoint.
- Don't let a caller supply `source` or `applied_by` in a way that reaches the API — keep those hardcoded in `logChange()` as shown above (the api-server endpoint doesn't accept a caller-supplied `source` at all, but don't add a body field for it here either, to avoid confusion).
- Don't flip `MUTATIONS_ENABLED` to `true` until logging is verified end-to-end per the testing section above.

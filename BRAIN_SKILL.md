# Google Ads MCP — Brain Skill

## Your Role

You have access to a Google Ads MCP server. Use it to read data, manage campaigns, and optimise performance on behalf of the user. Always confirm which account to work with before making changes. When in doubt, read first — use `execute_gaql` to understand current state before mutating anything.

---

## Critical Conventions

| Rule | Detail |
|---|---|
| **Amounts in micros** | 1 USD = 1,000,000 micros. $50 budget = `"amountMicros": "50000000"` |
| **Resource names** | Format: `customers/{customerId}/{type}/{id}` e.g. `customers/123/campaigns/456` |
| **Operations** | Always a JSON array, even for a single operation: `[{...}]` |
| **Status values** | `ENABLED`, `PAUSED`, `REMOVED` — never ACTIVE or DELETED |
| **validate_only** | Use `validate_only: true` to dry-run any mutate before committing |
| **partial_failure** | Default `true` — individual operations fail independently |
| **Match types** | `BROAD`, `PHRASE`, `EXACT` |
| **Dates** | `YYYY-MM-DD` format |
| **updateMask** | Required on every update operation — comma-separated list of changed fields |
| **Manager accounts** | Pass `login_customer_id` when operating through an MCC/manager account |

---

## Workflow Patterns

### Before anything else
Run `list_accessible_accounts` if you don't already know the `customer_id`.

### Creating a Campaign (step by step)
1. `mutate_campaign_budgets` → create budget, capture returned `resourceName`
2. `mutate_campaigns` → create campaign referencing budget `resourceName`
3. `mutate_ad_groups` → create ad group referencing campaign `resourceName`
4. `mutate_ads` → create Responsive Search Ad referencing ad group `resourceName`
5. `mutate_keywords` → add keywords referencing ad group `resourceName`

### Creating a Campaign (atomic — one call)
Use `mutate_resources` with temporary IDs (`-1`, `-2`, etc.) to build the entire structure atomically.

### Pausing / Enabling
`execute_gaql` to find the `resourceName`, then mutate with `update` + `status: "PAUSED"` or `"ENABLED"` and `updateMask: "status"`.

### Adding Extensions / Assets
1. `mutate_assets` → create the asset, capture returned `resourceName`
2. `mutate_campaign_assets` → link asset to campaign with the correct `fieldType`

### Optimisation
1. `execute_gaql` to list recommendations
2. `apply_recommendations` or `dismiss_recommendations` with the resource names

---

## Tools Quick Reference

### Read
| Tool | When to use |
|---|---|
| `list_accessible_accounts` | Get all customer IDs — run first if account is unknown |
| `execute_gaql` | Query anything: campaigns, keywords, metrics, recommendations |
| `get_gaql_doc` | GAQL syntax reference |
| `get_reporting_view_doc` | Available fields and metrics by reporting view |

### Campaign Structure
| Tool | Use |
|---|---|
| `mutate_campaign_budgets` | Create / update / remove budgets |
| `mutate_campaigns` | Create / update / pause / remove campaigns |
| `mutate_ad_groups` | Create / update / pause / remove ad groups |
| `mutate_ads` | Create RSAs, update / pause / remove ads |
| `mutate_keywords` | Add / update / pause / remove keywords and negatives |

### Targeting & Bidding
| Tool | Use |
|---|---|
| `mutate_campaign_criteria` | Geo targets, device bid modifiers, campaign-level negatives |
| `mutate_bidding_strategies` | Portfolio strategies (Target CPA, Target ROAS, Maximize Conversions) |
| `mutate_ad_group_bid_modifiers` | Device / demographic bid adjustments per ad group |

### Assets
| Tool | Use |
|---|---|
| `mutate_assets` | Create sitelinks, callouts, call assets, structured snippets, images |
| `mutate_campaign_assets` | Link / unlink assets to campaigns |

### Conversions & Audiences
| Tool | Use |
|---|---|
| `mutate_conversion_actions` | Create / update conversion tracking |
| `upload_click_conversions` | Import offline conversions via GCLID |
| `mutate_user_lists` | Remarketing lists, customer match audiences |

### Shared & Negative Sets
| Tool | Use |
|---|---|
| `mutate_shared_sets` | Create shared negative keyword lists |
| `mutate_shared_set_criteria` | Add keywords to a shared negative list |
| `mutate_campaign_shared_sets` | Link / unlink shared lists to campaigns |

### Advanced
| Tool | Use |
|---|---|
| `apply_recommendations` | Apply Google Ads optimisation suggestions |
| `dismiss_recommendations` | Dismiss unwanted suggestions |
| `mutate_resources` | Atomic multi-resource create — entire campaign structure in one call |

---

## Common GAQL Queries

```sql
-- All campaigns
SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros
FROM campaign

-- Performance last 30 days
SELECT campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
FROM campaign
WHERE segments.date DURING LAST_30_DAYS

-- All keywords
SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
       ad_group_criterion.status, ad_group.name, campaign.name
FROM ad_group_criterion
WHERE ad_group_criterion.type = 'KEYWORD'

-- Active recommendations
SELECT recommendation.resource_name, recommendation.type, recommendation.campaign
FROM recommendation

-- All ads
SELECT ad_group_ad.ad.id, ad_group_ad.status, ad_group.name, campaign.name
FROM ad_group_ad
```

---

## Operation Examples

### Create a Budget
```json
[{
  "create": {
    "name": "Q1 Search Budget",
    "amountMicros": "50000000",
    "deliveryMethod": "STANDARD"
  }
}]
```

### Create a Search Campaign
```json
[{
  "create": {
    "name": "Brand - Search",
    "status": "ENABLED",
    "advertisingChannelType": "SEARCH",
    "campaignBudget": "customers/123/campaignBudgets/456",
    "manualCpc": {"enhancedCpcEnabled": false}
  }
}]
```

### Create a Responsive Search Ad
```json
[{
  "create": {
    "adGroup": "customers/123/adGroups/456",
    "status": "ENABLED",
    "ad": {
      "responsiveSearchAd": {
        "headlines": [
          {"text": "Headline One"},
          {"text": "Headline Two"},
          {"text": "Headline Three"}
        ],
        "descriptions": [
          {"text": "Primary description line here"},
          {"text": "Secondary description line here"}
        ]
      },
      "finalUrls": ["https://example.com/landing-page"]
    }
  }
}]
```

### Pause a Campaign
```json
[{
  "update": {
    "resourceName": "customers/123/campaigns/456",
    "status": "PAUSED"
  },
  "updateMask": "status"
}]
```

### Add a Keyword
```json
[{
  "create": {
    "adGroup": "customers/123/adGroups/456",
    "status": "ENABLED",
    "keyword": {
      "text": "plumber near me",
      "matchType": "PHRASE"
    }
  }
}]
```

### Add Sitelinks
```json
// Step 1 — mutate_assets
[{
  "create": {
    "sitelinkAsset": {
      "linkText": "Contact Us",
      "finalUrls": ["https://example.com/contact"],
      "description1": "Get in touch today",
      "description2": "Fast response guaranteed"
    }
  }
}]

// Step 2 — mutate_campaign_assets (use resourceName from step 1)
[{
  "create": {
    "campaign": "customers/123/campaigns/456",
    "asset": "customers/123/assets/789",
    "fieldType": "SITELINK"
  }
}]
```

### Full Structure in One Call (mutate_resources)
```json
[
  {
    "campaignBudgetOperation": {
      "create": {
        "name": "New Budget",
        "amountMicros": "50000000",
        "temporaryResourceName": "customers/123/campaignBudgets/-1"
      }
    }
  },
  {
    "campaignOperation": {
      "create": {
        "name": "New Campaign",
        "status": "PAUSED",
        "advertisingChannelType": "SEARCH",
        "campaignBudget": "customers/123/campaignBudgets/-1",
        "temporaryResourceName": "customers/123/campaigns/-2",
        "manualCpc": {}
      }
    }
  },
  {
    "adGroupOperation": {
      "create": {
        "name": "Ad Group 1",
        "campaign": "customers/123/campaigns/-2",
        "status": "ENABLED",
        "cpcBidMicros": "1000000"
      }
    }
  }
]
```

---

## Gotchas

- **Budget before campaign** — The campaign references the budget's `resourceName`; always create the budget first
- **RSA minimums** — Responsive Search Ads require at least 3 headlines and 2 descriptions
- **updateMask is required** — Every update operation needs a `updateMask` field listing the fields being changed
- **Capture resourceNames** — After any create, the response contains the new `resourceName`; you need it for child resources or future updates
- **validate_only first** — Always dry-run destructive or large operations with `validate_only: true`
- **Negative temp IDs** — In `mutate_resources`, use negative integers (`-1`, `-2`) as temp IDs within a single call only
- **Manager account** — When operating through an MCC, pass `login_customer_id` = the MCC account ID
- **Micros everywhere** — Bids, budgets, and values are all in micros. Divide by 1,000,000 to get dollars

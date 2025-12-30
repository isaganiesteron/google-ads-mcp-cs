# Google Ads MCP Server - Test Prompts

Use these prompts in TypingMind to verify your MCP server is working correctly. Test them in order, or pick specific ones to verify particular functionality.

## Test Prompts (10 total)

### 1. Basic Connection Test

**Prompt:** "List all my accessible Google Ads accounts."

**Expected:** Should call `list_accessible_accounts` and return a list of all Google Ads customer accounts accessible with your credentials, including customer IDs, descriptive names, and resource names.

---

### 2. GAQL Documentation

**Prompt:** "Show me the documentation for Google Ads Query Language (GAQL). How do I write queries?"

**Expected:** Should call `get_gaql_doc` and return comprehensive documentation about GAQL syntax, query structure, available resources, and how to write queries.

---

### 3. Reporting View Documentation - General

**Prompt:** "What reporting views are available in Google Ads? Show me the documentation for reporting views."

**Expected:** Should call `get_reporting_view_doc` without a specific view parameter, returning documentation about all available reporting views and their purposes.

---

### 4. Reporting View Documentation - Specific

**Prompt:** "Show me the documentation for the campaign reporting view. What fields and metrics can I query?"

**Expected:** Should call `get_reporting_view_doc` with view="campaign", returning detailed documentation about campaign fields, metrics, segments, and how to use them in queries.

---

### 5. Simple Campaign Query

**Prompt:** "List all my campaigns. Use the first customer ID from my accessible accounts if you need one."

**Expected:** Should call `list_accessible_accounts` first, then `execute_gaql` with a query like `SELECT campaign.id, campaign.name, campaign.status FROM campaign`, returning all campaigns with their IDs, names, and statuses.

---

### 6. Campaign Performance Metrics

**Prompt:** "Show me campaign performance data for the last 30 days. Include impressions, clicks, cost, and conversions for my main account."

**Expected:** Should call `execute_gaql` with a query that includes metrics like `SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date DURING LAST_30_DAYS`, returning performance data with formatted metrics.

---

### 7. Ad Group Query

**Prompt:** "List all ad groups from my campaigns. Show me the ad group name, campaign name, and status."

**Expected:** Should call `execute_gaql` with a query like `SELECT ad_group.id, ad_group.name, campaign.name, ad_group.status FROM ad_group ORDER BY campaign.name, ad_group.name`, returning ad groups with their associated campaigns.

---

### 8. Keyword Performance Query

**Prompt:** "Show me keyword performance data for the last 7 days. Include keyword text, match type, impressions, clicks, and cost."

**Expected:** Should call `execute_gaql` with a query like `SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, metrics.impressions, metrics.clicks, metrics.cost_micros FROM keyword_view WHERE segments.date DURING LAST_7_DAYS ORDER BY metrics.clicks DESC`, returning keyword performance data.

---

### 9. Filtered Query with Date Range

**Prompt:** "Find all active campaigns that spent more than $100 in the last 30 days. Show campaign name, cost, and conversions."

**Expected:** Should call `execute_gaql` with a query like `SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.conversions FROM campaign WHERE campaign.status = 'ENABLED' AND segments.date DURING LAST_30_DAYS HAVING metrics.cost_micros > 100000000 ORDER BY metrics.cost_micros DESC`, returning filtered campaign results.

---

### 10. Complex Multi-Resource Query

**Prompt:** "Show me a comprehensive report with campaign name, ad group name, ad type, impressions, clicks, CTR, and cost for the last 14 days. Group by campaign and ad group."

**Expected:** Should call `execute_gaql` with a complex query like `SELECT campaign.name, ad_group.name, ad_group_ad.ad.type, metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros FROM ad_group_ad WHERE segments.date DURING LAST_14_DAYS ORDER BY campaign.name, ad_group.name, metrics.clicks DESC`, returning a detailed multi-resource report with formatted metrics.

---

## Quick Verification Checklist

After running all prompts, verify:

- [ ] All 10 prompts execute without errors
- [ ] Responses are formatted clearly (not raw JSON)
- [ ] Tool names are being called correctly
- [ ] Customer IDs are properly formatted (with or without dashes)
- [ ] Date ranges work correctly (LAST_7_DAYS, LAST_30_DAYS, etc.)
- [ ] Error handling works for invalid queries or customer IDs
- [ ] OAuth token refresh works if tokens expire during testing
- [ ] GAQL queries return properly formatted results
- [ ] Metrics are displayed in human-readable format (e.g., cost in dollars, not micros)
- [ ] Documentation tools return helpful, readable content

## Tips

1. **Start Simple**: Run test #1 first to verify basic connectivity and get your customer IDs
2. **Use Real Data**: The prompts use your actual Google Ads accounts, so you'll see real results
3. **Check Logs**: If something fails, check Cloudflare Workers logs with `wrangler tail`
4. **Token Expiry**: If you see authentication errors, the server should auto-refresh tokens
5. **Customer ID Format**: Customer IDs can be used with or without dashes (e.g., "123-456-7890" or "1234567890")
6. **GAQL Syntax**: Use `get_gaql_doc` if you need help writing queries
7. **View Documentation**: Use `get_reporting_view_doc` to discover available fields and metrics for specific resources
8. **Date Ranges**: Common date range formats include `LAST_7_DAYS`, `LAST_30_DAYS`, `LAST_90_DAYS`, or specific dates like `"2024-01-01" AND "2024-01-31"`
9. **Cost Values**: Google Ads API returns cost in micros (1/1,000,000 of currency unit), so $1.00 = 1,000,000 micros
10. **Rate Limits**: Be aware of Google Ads API rate limits when running multiple queries

## Expected Response Format

All tools should return human-readable text with:

- Clear section headers
- Formatted numbers (e.g., "$1,234.56" not "123456000 micros")
- Visual indicators (✓, ⚠, ❌, →)
- Structured data when appropriate (tables, lists)
- Actionable insights and recommendations

If you see raw JSON or error stacks, there may be an issue with the tool response formatting.

## Common GAQL Query Patterns

For reference, here are some common query patterns you might use:

- **List resources**: `SELECT resource.id, resource.name FROM resource`
- **With metrics**: `SELECT resource.id, resource.name, metrics.impressions, metrics.clicks FROM resource`
- **With date filter**: `SELECT ... FROM resource WHERE segments.date DURING LAST_30_DAYS`
- **With status filter**: `SELECT ... FROM resource WHERE resource.status = 'ENABLED'`
- **With ordering**: `SELECT ... FROM resource ORDER BY metrics.clicks DESC`
- **With limit**: `SELECT ... FROM resource LIMIT 100`
- **With HAVING**: `SELECT ... FROM resource HAVING metrics.clicks > 100`


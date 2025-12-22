# Local Testing Setup Guide

## Quick Start

### 1. Create `.dev.vars` file

Copy the example file and fill in your credentials:

```bash
# On Windows (PowerShell)
Copy-Item .dev.vars.example .dev.vars

# On Linux/Mac
cp .dev.vars.example .dev.vars
```

Then edit `.dev.vars` and replace the placeholder values with your actual Google Ads API credentials.

### 2. Start the development server

```bash
npm run dev
```

The server will start at `http://localhost:8787` (or another port if 8787 is busy).

### 3. Test the server

#### Option A: Use the test scripts

**Windows (PowerShell):**
```powershell
.\test-local.ps1
```

**Linux/Mac:**
```bash
chmod +x test-local.sh
./test-local.sh
```

#### Option B: Manual testing with curl

**Health Check:**
```bash
curl http://localhost:8787
```

**List Tools:**
```bash
curl -X POST http://localhost:8787/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**List Accessible Accounts:**
```bash
curl -X POST http://localhost:8787/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_accessible_accounts","arguments":{}}}'
```

**Execute GAQL Query:**
```bash
curl -X POST http://localhost:8787/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"execute_gaql","arguments":{"query":"SELECT campaign.id, campaign.name FROM campaign LIMIT 10","customer_id":"YOUR_CUSTOMER_ID"}}}'
```

**Get GAQL Documentation:**
```bash
curl -X POST http://localhost:8787/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_gaql_doc","arguments":{}}}'
```

## Troubleshooting

### Port already in use
If port 8787 is busy, Wrangler will automatically use another port. Check the console output for the actual URL.

### Missing credentials error
Make sure all required environment variables are set in `.dev.vars`:
- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (optional)

### Invalid credentials
Verify your credentials are correct:
- Client ID and Secret should be from Google Cloud Console
- Refresh token should be generated via OAuth flow
- Developer token should be from your Google Ads account (API Center)

### API errors
Check the console logs for detailed error messages. Common issues:
- Developer token not approved
- Refresh token expired
- Invalid customer ID format (should be numbers only, no dashes)

## Next Steps

Once local testing works:
1. Deploy to Cloudflare Workers: `npm run deploy`
2. Set secrets in Cloudflare: `wrangler secret put GOOGLE_ADS_CLIENT_ID` (etc.)
3. Connect your MCP client to the deployed URL


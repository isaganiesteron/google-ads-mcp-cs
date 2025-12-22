# Testing with Postman

## Import the Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select the file `Google_Ads_MCP.postman_collection.json`
4. The collection will appear in your workspace

## Prerequisites

1. Make sure your dev server is running:
   ```bash
   npm run dev
   ```

2. Ensure your `.dev.vars` file has valid Google Ads credentials (for tools that require API access)

## Test Requests

### 1. Health Check
- **Method**: GET
- **URL**: `http://localhost:8787`
- **Expected**: Returns server status and version info

### 2. Initialize
- **Method**: POST
- **URL**: `http://localhost:8787/sse`
- **Body**: JSON-RPC initialize request
- **Expected**: Returns server capabilities and info

### 3. List Tools
- **Method**: POST
- **URL**: `http://localhost:8787/sse`
- **Body**: JSON-RPC tools/list request
- **Expected**: Returns list of 4 available tools:
  - `list_accessible_accounts`
  - `execute_gaql`
  - `get_gaql_doc`
  - `get_reporting_view_doc`

### 4. Get GAQL Documentation
- **Method**: POST
- **URL**: `http://localhost:8787/sse`
- **Body**: JSON-RPC tools/call for `get_gaql_doc`
- **Expected**: Returns GAQL documentation (no credentials needed)

### 5. Get Reporting View Documentation
- **Method**: POST
- **URL**: `http://localhost:8787/sse`
- **Body**: JSON-RPC tools/call for `get_reporting_view_doc`
- **Expected**: Returns reporting view documentation (no credentials needed)

### 6. List Accessible Accounts
- **Method**: POST
- **URL**: `http://localhost:8787/sse`
- **Body**: JSON-RPC tools/call for `list_accessible_accounts`
- **Expected**: Returns list of accessible Google Ads customer accounts
- **Note**: Requires valid credentials in `.dev.vars`

### 7. Execute GAQL Query
- **Method**: POST
- **URL**: `http://localhost:8787/sse`
- **Body**: JSON-RPC tools/call for `execute_gaql`
- **Before testing**: Replace `YOUR_CUSTOMER_ID` in the request body with your actual customer ID
- **Expected**: Returns query results from Google Ads API
- **Note**: Requires valid credentials in `.dev.vars`

## Expected Response Format

All successful responses follow JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    // Tool-specific result data
  }
}
```

Error responses:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Error description"
  }
}
```

## Troubleshooting

### Parse Error
- **Symptom**: `{"jsonrpc":"2.0","error":{"code":-32700,"message":"Parse error"}}`
- **Solution**: Check that the request body is valid JSON and Content-Type header is set to `application/json`

### Missing Credentials Error
- **Symptom**: Error about missing Google Ads credentials
- **Solution**: Ensure `.dev.vars` file exists and contains all required variables

### Invalid Customer ID
- **Symptom**: Error when executing GAQL queries
- **Solution**: Customer ID should be numbers only (no dashes), e.g., `1234567890` not `123-456-7890`

### Server Not Running
- **Symptom**: Connection refused or timeout
- **Solution**: Start the dev server with `npm run dev` and check the console for the correct port

## Tips

1. **Check Server Logs**: The dev server console will show detailed logs including:
   - Received request bodies
   - Parsed messages
   - API responses
   - Error details

2. **Test Order**: Start with simple requests (health check, list tools) before testing API-dependent tools

3. **Environment Variables**: You can create a Postman environment to easily switch between local and deployed URLs

4. **Save Responses**: Postman allows you to save example responses for documentation


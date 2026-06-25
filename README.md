# Google Ads MCP Server

The Google Ads MCP Server is an implementation of the Model Context Protocol (MCP) that enables Large Language Models (LLMs) to interact directly with the Google Ads API. This implementation runs on Cloudflare Workers, providing a serverless, globally distributed MCP server.

> **Note**: This project was developed by [ContractorScale](https://contractorscale.com). The "cs" suffix in the project name refers to ContractorScale.

**This is not an officially supported Google product.**

## Disclaimer

Copyright Google LLC. Supported by Google LLC and/or its affiliate(s). This solution, including any related sample code or data, is made available on an "as is," "as available," and "with all faults" basis, solely for illustrative purposes, and without warranty or representation of any kind. This solution is experimental, unsupported and provided solely for your convenience. Your use of it is subject to your agreements with Google, as applicable, and may constitute a beta feature as defined under those agreements. To the extent that you make any data available to Google in connection with your use of the solution, you represent and warrant that you have all necessary and appropriate rights, consents and permissions to permit Google to use and process that data. By using any portion of this solution, you acknowledge, assume and accept all risks, known and unknown, associated with its usage and any processing of data by Google, including with respect to your deployment of any portion of this solution in your systems, or usage in connection with your business, if at all. With respect to the entrustment of personal information to Google, you will verify that the established system is sufficient by checking Google's privacy policy and other public information, and you agree that no further information will be provided by Google.

## Features

- **Google Ads API Integration**: Direct access to Google Ads API functionality
- **Cloudflare Workers**: Serverless deployment with global edge network
- **SSE Support**: Real-time communication with MCP clients via Server-Sent Events (e.g. TypingMind)
- **Streamable HTTP (MCP)**: Direct `POST /mcp` endpoint for MCP clients that use HTTP transport
- **Production Logging**: Structured `[fetch]` / `[handleMessage]` logs for `wrangler tail` debugging
- **TypeScript**: Full type safety and excellent developer experience
- **Modular Tools**: Easy-to-extend tool system for Google Ads operations
- **Production Ready**: Includes error handling, CORS, health checks, and session management

## Getting Started

### 1. Prerequisites

- Node.js 18+ and npm
- A Google Ads account with API access
- Google Ads API credentials (see step 2)
- A Cloudflare account (for deployment)

### 2. Configure Google Ads API Credentials

This tool requires Google Ads API credentials. You'll need to set up OAuth2 credentials and obtain the following:

- `client_id`: Your OAuth2 client ID
- `client_secret`: Your OAuth2 client secret
- `refresh_token`: OAuth2 refresh token
- `developer_token`: Your Google Ads API developer token
- `login_customer_id`: (Optional) The customer ID to use for login

You can generate these credentials by following the [Google Ads API authentication guide](https://developers.google.com/google-ads/api/docs/oauth/overview).

### 3. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/google-ads-mcp-cs.git
cd google-ads-mcp-cs
npm install
```

### 4. Configure Environment Variables

Set up your Google Ads credentials as Cloudflare Workers secrets:

```bash
# Using Wrangler CLI
wrangler secret put GOOGLE_ADS_CLIENT_ID
wrangler secret put GOOGLE_ADS_CLIENT_SECRET
wrangler secret put GOOGLE_ADS_REFRESH_TOKEN
wrangler secret put GOOGLE_ADS_DEVELOPER_TOKEN
wrangler secret put GOOGLE_ADS_LOGIN_CUSTOMER_ID  # Optional
```

Or for local development, create a `.dev.vars` file (this file should be in `.gitignore`):

```bash
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_LOGIN_CUSTOMER_ID=your_customer_id  # Optional
```

### 5. Customize Your MCP Server

Update the configuration in `src/index.ts`:

```typescript
const CONFIG = {
	serverName: 'google-ads-mcp',
	serverVersion: '1.0.0',
	serverDescription: 'Google Ads MCP Server',
	protocolVersion: '2025-03-26', // previously '2024-11-05'
	keepAliveInterval: 30000,
} as const;
```

### 6. Add Google Ads Tools

Replace the example tools in `src/index.ts` with Google Ads API tools. Examples include:

- List all campaigns
- Get campaign metrics
- List ad groups
- Get ad group performance
- And more...

### 7. Test Locally

```bash
npm run dev
```

Your server will be available at `http://localhost:8787`

Test the health endpoint:

```bash
curl http://localhost:8787
```

### 8. Deploy to Cloudflare Workers

```bash
npm run deploy
```

After deployment, Cloudflare will provide your worker URL (e.g., `https://google-ads-mcp.YOUR_SUBDOMAIN.workers.dev`)

## Using with MCP Clients

### TypingMind

1. Deploy your MCP server to Cloudflare Workers
2. In TypingMind, go to Settings → MCP Servers
3. Add a new server:
   - **Name**: Google Ads MCP Server
   - **URL**: Your Cloudflare Worker URL (e.g., `https://google-ads-mcp.YOUR_SUBDOMAIN.workers.dev/sse`)
   - **Transport**: SSE
4. Test the connection

### Other MCP Clients

The server supports the standard MCP protocol over two transports:

**SSE (Server-Sent Events)**

- **Connect**: `GET https://your-worker-url.workers.dev/sse`
- **Send messages**: `POST https://your-worker-url.workers.dev/sse/message?sessionId={id}`
- **Direct HTTP fallback**: `POST https://your-worker-url.workers.dev/sse`

**Streamable HTTP (MCP)**

- **Endpoint**: `POST https://your-worker-url.workers.dev/mcp`
- **Headers**: `Content-Type: application/json`, plus `X-API-Key` or `Authorization: Bearer <token>` if `API_KEY` is configured
- **Body**: JSON-RPC 2.0 MCP messages (e.g. `initialize`, `tools/list`, `tools/call`)

Example `initialize` request:

```bash
curl -X POST https://your-worker-url.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

## Example Usage

Once connected, you can ask questions like:

- "list all campaigns"
- "show me metrics for campaign `[CAMPAIGN_ID]`"
- "get all ad groups"
- "show performance for ad group `[AD_GROUP_ID]`"

## Project Structure

```
.
├── src/
│   └── index.ts          # Main MCP server code with Google Ads tools
├── test/
│   └── index.spec.ts     # Tests
├── wrangler.jsonc        # Cloudflare Workers config
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript config
└── README.md             # This file
```

## API Endpoints

- `GET /` - Health check endpoint (returns available endpoints, including `/sse` and `/mcp`)
- `GET /sse` - SSE endpoint for establishing connection
- `POST /sse` - Direct HTTP endpoint (for clients that don't use SSE)
- `POST /sse/message?sessionId={id}` - Message endpoint for active SSE sessions
- `POST /mcp` - Streamable HTTP MCP endpoint (JSON-RPC over HTTP; same message handler as `/sse`)

Protected endpoints (`/sse`, `/sse/message`, `/mcp`) require an API key when the `API_KEY` secret is set. Use the `X-API-Key` header or `Authorization: Bearer <token>`.

## Production Debugging

Use `wrangler tail` to stream logs from the deployed worker. Logs are prefixed for easy filtering:

- `[fetch]` — incoming request method/pathname, matched route, API key failures, 404s
- `[handleMessage]` — parsed MCP method (`initialize`, `tools/list`, `tools/call`, etc.), tool name on `tools/call`, full error messages with stack traces, and the JSON response sent back

```bash
wrangler tail
```

## Tool Development Guide

### Tool Interface

Each tool must implement the `Tool` interface:

```typescript
interface Tool {
	name: string; // Unique tool identifier
	description: string; // What the tool does
	inputSchema: {
		// JSON Schema for input validation
		type: string;
		properties: Record<string, { type: string; description: string }>;
		required: string[];
	};
	handler: (args: Record<string, unknown>, env: Env) => Promise<ToolResult> | ToolResult;
}
```

### Example Google Ads Tool

```typescript
{
	name: 'list_campaigns',
	description: 'Lists all campaigns in the Google Ads account',
	inputSchema: {
		type: 'object',
		properties: {
			customer_id: {
				type: 'string',
				description: 'The Google Ads customer ID'
			},
		},
		required: ['customer_id'],
	},
	handler: async (args, env) => {
		try {
			// Initialize Google Ads API client
			// Fetch campaigns
			// Return results
			return {
				content: [{
					type: 'text',
					text: JSON.stringify(campaigns, null, 2),
				}],
			};
		} catch (error) {
			throw new Error(`Failed to list campaigns: ${error.message}`);
		}
	},
}
```

### Accessing Environment Variables

Google Ads credentials are available through the `env` parameter:

```typescript
handler: async (args, env) => {
	const clientId = env.GOOGLE_ADS_CLIENT_ID;
	const clientSecret = env.GOOGLE_ADS_CLIENT_SECRET;
	const refreshToken = env.GOOGLE_ADS_REFRESH_TOKEN;
	const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;
	const loginCustomerId = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

	// Use credentials to authenticate with Google Ads API
};
```

## Google Ads API Setup

### Getting a Developer Token

1. Sign in to your Google Ads account
2. Go to Tools & Settings → API Center
3. Apply for a developer token (approval may take 24-48 hours)

### Creating OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Ads API
4. Create OAuth2 credentials (Desktop app type)
5. Download the credentials JSON file

### Generating a Refresh Token

Use the [Google Ads API authentication example](https://github.com/googleads/google-ads-python/blob/main/examples/authentication/authenticate_in_desktop_application.py) or similar tool to generate a refresh token.

## Advanced Configuration

### CORS Configuration

By default, CORS allows all origins (`*`). To restrict:

```typescript
const corsHeaders = {
	'Access-Control-Allow-Origin': 'https://yourdomain.com',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Accept',
};
```

### Custom Keep-Alive Interval

Modify in CONFIG section:

```typescript
const CONFIG = {
	keepAliveInterval: 60000, // 60 seconds instead of 30
	...
};
```

## Testing

Run tests:

```bash
npm test
```

The template includes Vitest with Cloudflare Workers test environment.

## Troubleshooting

### "Tool not found" error

- Ensure tool names match exactly (case-sensitive)
- Check that tool is in the TOOLS array
- Verify the tool is being exported in tools/list response

### SSE connection issues

- Check CORS headers if connecting from a web app
- Verify firewall isn't blocking SSE connections
- Test with `curl -N http://localhost:8787/sse` to see raw SSE stream

### MCP HTTP (`/mcp`) connection issues

- Confirm the client is using `POST /mcp` with `Content-Type: application/json`
- Verify the API key header if `API_KEY` is configured
- Check that the client sends MCP protocol version `2025-03-26` in `initialize`
- Use `wrangler tail` and filter for `[handleMessage]` to see parsed methods and responses

### Google Ads API errors

- Verify your developer token is approved and active
- Check that OAuth2 credentials are correct
- Ensure refresh token hasn't expired
- Verify customer ID is correct and accessible

### Deployment fails

- Ensure you're logged in to Cloudflare: `wrangler login`
- Check that worker name in wrangler.jsonc is unique
- Verify your Cloudflare account has Workers enabled
- Ensure all required secrets are set: `wrangler secret list`

## Resources

- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/start)
- [Google Ads API Authentication](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

## Contributing

We welcome contributions! Please see our CONTRIBUTING.md guide for details.

## License

Google Ads MCP Server is an open-source project licensed under the APACHE-2.0 License.

## Contact

If you have any questions, suggestions, or feedback, please feel free to open an issue.

---

Built with the Model Context Protocol (MCP) for Google Ads API integration.

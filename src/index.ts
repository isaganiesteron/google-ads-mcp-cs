/**
 * ============================================================================
 * CUSTOMIZATION SECTION - Update these values for your MCP server
 * ============================================================================
 */

// Import Google Ads client functions
import { listAccessibleCustomers, executeGaqlQuery, getGaqlDocumentation, getReportingViewDocumentation } from './google-ads-client';

const CONFIG = {
	serverName: 'google-ads-mcp',
	serverVersion: '1.0.0',
	serverDescription: 'Google Ads MCP Server',
	protocolVersion: '2024-11-05',
	keepAliveInterval: 30000, // 30 seconds
} as const;

/**
 * ============================================================================
 * TOOL DEFINITIONS - Add your custom tools here
 * ============================================================================
 * Each tool should have:
 * - name: unique identifier for the tool
 * - description: what the tool does
 * - inputSchema: JSON schema defining the input parameters
 * - handler: function that executes the tool logic
 */

interface Tool {
	name: string;
	description: string;
	inputSchema: {
		type: string;
		properties: Record<string, { type: string; description: string }>;
		required: string[];
	};
	handler: (args: Record<string, unknown>, env: Env) => Promise<ToolResult> | ToolResult;
}

interface ToolResult {
	content: Array<{
		type: string;
		text: string;
	}>;
}

// Define your tools here
const TOOLS: Tool[] = [
	{
		name: 'list_accessible_accounts',
		description: 'Lists all Google Ads customer accounts that are accessible with the current credentials',
		inputSchema: {
			type: 'object',
			properties: {},
			required: [],
		},
		handler: async (args: Record<string, unknown>, env: Env): Promise<ToolResult> => {
			try {
				const credentials = {
					client_id: env.GOOGLE_ADS_CLIENT_ID,
					client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
					refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
					developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
					login_customer_id: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
				};

				// Validate required credentials
				if (!credentials.client_id || !credentials.client_secret || !credentials.refresh_token || !credentials.developer_token) {
					throw new Error('Missing required Google Ads credentials. Please check your environment variables.');
				}

				const result = await listAccessibleCustomers(credentials);

				// Return formatted text for human readability and AI understanding
				// Include both formatted text and structured data
				const responseText = result.formatted
					? `${result.formatted}\n\n---\n\n**Structured Data (JSON):**\n\`\`\`json\n${JSON.stringify(
							{ accounts: result.accounts, resourceNames: result.resourceNames },
							null,
							2
					  )}\n\`\`\``
					: JSON.stringify(result, null, 2);

				return {
					content: [
						{
							type: 'text',
							text: responseText,
						},
					],
				};
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				throw new Error(`Failed to list accessible accounts: ${errorMessage}`);
			}
		},
	},
	{
		name: 'execute_gaql',
		description: 'Executes a Google Ads Query Language (GAQL) query and returns the results',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The GAQL query to execute (e.g., "SELECT campaign.id, campaign.name FROM campaign")',
				},
				customer_id: {
					type: 'string',
					description: 'The Google Ads customer ID to query (e.g., "1234567890")',
				},
				login_customer_id: {
					type: 'string',
					description: 'Optional login customer ID for manager accounts',
				},
			},
			required: ['query', 'customer_id'],
		},
		handler: async (args: Record<string, unknown>, env: Env): Promise<ToolResult> => {
			try {
				const query = args.query as string;
				const customer_id = args.customer_id as string;
				const login_customer_id = args.login_customer_id as string | undefined;

				if (!query || !customer_id) {
					throw new Error('query and customer_id are required');
				}

				const credentials = {
					client_id: env.GOOGLE_ADS_CLIENT_ID,
					client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
					refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
					developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
					login_customer_id: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
				};

				// Validate required credentials
				if (!credentials.client_id || !credentials.client_secret || !credentials.refresh_token || !credentials.developer_token) {
					throw new Error('Missing required Google Ads credentials. Please check your environment variables.');
				}

				const result = await executeGaqlQuery(credentials, query, customer_id, login_customer_id);
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				throw new Error(`Failed to execute GAQL query: ${errorMessage}`);
			}
		},
	},
	{
		name: 'get_gaql_doc',
		description: 'Returns documentation about Google Ads Query Language (GAQL) syntax and available resources',
		inputSchema: {
			type: 'object',
			properties: {},
			required: [],
		},
		handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
			try {
				const documentation = getGaqlDocumentation();
				return {
					content: [
						{
							type: 'text',
							text: documentation,
						},
					],
				};
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				throw new Error(`Failed to get GAQL documentation: ${errorMessage}`);
			}
		},
	},
	{
		name: 'get_reporting_view_doc',
		description: 'Returns documentation about Google Ads reporting views and available fields/metrics',
		inputSchema: {
			type: 'object',
			properties: {
				view: {
					type: 'string',
					description: 'Optional specific reporting view to get documentation for (e.g., "campaign", "ad_group", "keyword")',
				},
			},
			required: [],
		},
		handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
			try {
				const view = args.view as string | undefined;
				const documentation = getReportingViewDocumentation(view);
				return {
					content: [
						{
							type: 'text',
							text: documentation,
						},
					],
				};
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				throw new Error(`Failed to get reporting view documentation: ${errorMessage}`);
			}
		},
	},
];

/**
 * ============================================================================
 * FRAMEWORK CODE - You typically don't need to modify below this line
 * ============================================================================
 */

// Session interface for SSE connections
interface Session {
	writer: WritableStreamDefaultWriter<Uint8Array>;
	encoder: TextEncoder;
}

// Store active sessions
const sessions = new Map<string, Session>();

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// CORS headers - modify if you need to restrict origins
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*', // Change to specific domain if needed
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Accept',
		};

		console.log(`${request.method} ${url.pathname}`);

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// Health check endpoint
		if (url.pathname === '/' || url.pathname === '') {
			return new Response(
				JSON.stringify({
					name: CONFIG.serverDescription,
					version: CONFIG.serverVersion,
					status: 'running',
					endpoints: {
						sse: '/sse',
					},
				}),
				{
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders,
					},
				}
			);
		}

		// SSE endpoint - GET only
		if (url.pathname === '/sse' && request.method === 'GET') {
			const { readable, writable } = new TransformStream();
			const writer = writable.getWriter();
			const encoder = new TextEncoder();

			// Generate session ID
			const sessionId = crypto.randomUUID().replace(/\-/g, '');

			// Store session
			sessions.set(sessionId, { writer, encoder });
			console.log('Created SSE session:', sessionId);

			// Send endpoint immediately
			(async () => {
				try {
					await writer.write(encoder.encode(`event: endpoint\ndata: /sse/message?sessionId=${sessionId}\n\n`));

					// Keep-alive ping
					const keepAlive = setInterval(async () => {
						try {
							await writer.write(encoder.encode(': ping\n\n'));
						} catch {
							clearInterval(keepAlive);
							sessions.delete(sessionId);
						}
					}, CONFIG.keepAliveInterval);
				} catch (error) {
					console.error('SSE error:', error);
					sessions.delete(sessionId);
				}
			})();

			return new Response(readable, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					Connection: 'keep-alive',
					...corsHeaders,
				},
			});
		}

		// Handle POST to /sse (some clients do this for direct HTTP)
		if (url.pathname === '/sse' && request.method === 'POST') {
			console.log('Received POST to /sse - redirecting to message handler');
			// Treat this as a direct message without session
			return handleMessage(request, corsHeaders, null, env);
		}

		// Messages endpoint with session
		if (url.pathname === '/sse/message' && request.method === 'POST') {
			const sessionId = url.searchParams.get('sessionId');
			console.log('Received POST to /sse/message with sessionId:', sessionId);

			const session = sessions.get(sessionId || '') ?? null;
			return handleMessage(request, corsHeaders, session, env);
		}

		return new Response('Not Found', {
			status: 404,
			headers: corsHeaders,
		});
	},
};

// Centralized message handler
async function handleMessage(request: Request, corsHeaders: Record<string, string>, session: Session | null, env: Env) {
	try {
		const body = await request.text();
		console.log('Received body:', body);

		let message;
		try {
			message = JSON.parse(body);
		} catch (parseError) {
			console.error('JSON parse error:', parseError);
			const errorResponse = {
				jsonrpc: '2.0',
				error: {
					code: -32700,
					message: 'Parse error',
				},
			};
			return new Response(JSON.stringify(errorResponse), {
				status: 400,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders,
				},
			});
		}

		console.log('Parsed message:', JSON.stringify(message));

		let response: Record<string, unknown> | null = null;

		// Handle initialize
		if (message.method === 'initialize') {
			response = {
				jsonrpc: '2.0',
				id: message.id,
				result: {
					protocolVersion: CONFIG.protocolVersion,
					capabilities: { tools: {} },
					serverInfo: {
						name: CONFIG.serverName,
						version: CONFIG.serverVersion,
					},
				},
			};
		}
		// Handle tools/list
		else if (message.method === 'tools/list') {
			response = {
				jsonrpc: '2.0',
				id: message.id,
				result: {
					tools: TOOLS.map((tool) => ({
						name: tool.name,
						description: tool.description,
						inputSchema: tool.inputSchema,
					})),
				},
			};
		}
		// Handle tools/call
		else if (message.method === 'tools/call') {
			const { name, arguments: args } = message.params;

			// Find the tool by name
			const tool = TOOLS.find((t) => t.name === name);

			if (tool) {
				try {
					const result = await tool.handler(args, env);
					response = {
						jsonrpc: '2.0',
						id: message.id,
						result,
					};
				} catch (toolError: unknown) {
					const errorMessage = toolError instanceof Error ? toolError.message : 'Tool execution failed';
					response = {
						jsonrpc: '2.0',
						id: message.id,
						error: {
							code: -32603,
							message: errorMessage,
						},
					};
				}
			} else {
				response = {
					jsonrpc: '2.0',
					id: message.id,
					error: {
						code: -32601,
						message: `Unknown tool: ${name}`,
					},
				};
			}
		}
		// Handle notifications/initialized
		else if (message.method === 'notifications/initialized') {
			console.log('Received initialized notification');
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		} else {
			response = {
				jsonrpc: '2.0',
				id: message.id || null,
				error: {
					code: -32601,
					message: `Method not found: ${message.method}`,
				},
			};
		}

		console.log('Sending response:', JSON.stringify(response));

		// If we have a session, send via SSE
		if (session && response) {
			try {
				await session.writer.write(session.encoder.encode(`data: ${JSON.stringify(response)}\n\n`));
			} catch (sseError) {
				console.error('SSE write error:', sseError);
			}
		}

		// Always return response directly for HTTP
		if (response) {
			return new Response(JSON.stringify(response), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders,
				},
			});
		}

		return new Response(null, {
			status: 204,
			headers: corsHeaders,
		});
	} catch (error: unknown) {
		console.error('Message handling error:', error);
		const errorResponse = {
			jsonrpc: '2.0',
			error: {
				code: -32603,
				message: error instanceof Error ? error.message : 'Internal error',
			},
		};
		return new Response(JSON.stringify(errorResponse), {
			status: 500,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders,
			},
		});
	}
}

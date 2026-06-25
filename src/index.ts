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
	protocolVersion: '2025-03-26', // previously '2024-11-05'
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
			console.log('[list_accessible_accounts] Starting handler execution');
			console.log('[list_accessible_accounts] Args:', JSON.stringify(args));

			try {
				const credentials = {
					client_id: env.GOOGLE_ADS_CLIENT_ID,
					client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
					refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
					developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
					login_customer_id: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
				};

				console.log('[list_accessible_accounts] Credentials check:', {
					has_client_id: !!credentials.client_id,
					has_client_secret: !!credentials.client_secret,
					has_refresh_token: !!credentials.refresh_token,
					has_developer_token: !!credentials.developer_token,
					has_login_customer_id: !!credentials.login_customer_id,
				});

				// Validate required credentials
				if (!credentials.client_id || !credentials.client_secret || !credentials.refresh_token || !credentials.developer_token) {
					const missing = [];
					if (!credentials.client_id) missing.push('GOOGLE_ADS_CLIENT_ID');
					if (!credentials.client_secret) missing.push('GOOGLE_ADS_CLIENT_SECRET');
					if (!credentials.refresh_token) missing.push('GOOGLE_ADS_REFRESH_TOKEN');
					if (!credentials.developer_token) missing.push('GOOGLE_ADS_DEVELOPER_TOKEN');

					console.error('[list_accessible_accounts] Missing credentials:', missing);

					// Return error as ToolResult instead of throwing
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(
									{
										error: true,
										message: `Missing required Google Ads credentials: ${missing.join(', ')}. Please check your environment variables.`,
									},
									null,
									2
								),
							},
						],
					};
				}

				console.log('[list_accessible_accounts] Calling listAccessibleCustomers...');
				const result = await listAccessibleCustomers(credentials);
				console.log('[list_accessible_accounts] Received result:', {
					has_result: !!result,
					has_formatted: !!result?.formatted,
					has_accounts: !!result?.accounts,
					accounts_count: result?.accounts?.length || 0,
					has_resourceNames: !!result?.resourceNames,
					resourceNames_count: result?.resourceNames?.length || 0,
				});

				// Ensure result is valid
				if (!result) {
					console.error('[list_accessible_accounts] Result is null or undefined');

					// Return error as ToolResult instead of throwing
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(
									{
										error: true,
										message: 'Failed to retrieve accounts: No data returned from API',
									},
									null,
									2
								),
							},
						],
					};
				}

				// Return formatted text for human readability and AI understanding
				// Include both formatted text and structured data
				const responseText = result.formatted
					? `${result.formatted}\n\n---\n\n**Structured Data (JSON):**\n\`\`\`json\n${JSON.stringify(
							{ accounts: result.accounts, resourceNames: result.resourceNames },
							null,
							2
					  )}\n\`\`\``
					: JSON.stringify(result, null, 2);

				console.log('[list_accessible_accounts] Response text length:', responseText.length);

				const toolResult: ToolResult = {
					content: [
						{
							type: 'text',
							text: responseText,
						},
					],
				};

				console.log('[list_accessible_accounts] Returning tool result:', {
					has_content: !!toolResult.content,
					content_length: toolResult.content?.length || 0,
					first_content_type: toolResult.content?.[0]?.type,
					first_content_text_length: toolResult.content?.[0]?.text?.length || 0,
				});

				return toolResult;
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				const errorStack = error instanceof Error ? error.stack : undefined;

				console.error('[list_accessible_accounts] Error occurred:', {
					message: errorMessage,
					stack: errorStack,
					error_type: error?.constructor?.name || typeof error,
				});

				// Return error as ToolResult instead of throwing
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									error: true,
									message: `Failed to list accessible accounts: ${errorMessage}`,
								},
								null,
								2
							),
						},
					],
				};
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
					// Return error as ToolResult instead of throwing
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(
									{
										error: true,
										message: 'query and customer_id are required',
									},
									null,
									2
								),
							},
						],
					};
				}

				const credentials = {
					client_id: env.GOOGLE_ADS_CLIENT_ID,
					client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
					refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
					developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
					login_customer_id: login_customer_id || env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
				};

				// Validate required credentials
				if (!credentials.client_id || !credentials.client_secret || !credentials.refresh_token || !credentials.developer_token) {
					// Return error as ToolResult instead of throwing
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(
									{
										error: true,
										message: 'Missing required Google Ads credentials. Please check your environment variables.',
									},
									null,
									2
								),
							},
						],
					};
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

				// Return error as ToolResult instead of throwing
				// The error message from executeGaqlQuery already contains helpful context from the API
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									error: true,
									message: `Failed to execute GAQL query: ${errorMessage}`,
								},
								null,
								2
							),
						},
					],
				};
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

				// Return error as ToolResult instead of throwing
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									error: true,
									message: `Failed to get GAQL documentation: ${errorMessage}`,
								},
								null,
								2
							),
						},
					],
				};
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

				// Return error as ToolResult instead of throwing
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									error: true,
									message: `Failed to get reporting view documentation: ${errorMessage}`,
								},
								null,
								2
							),
						},
					],
				};
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

/**
 * Validate API key from request headers
 * Supports both X-API-Key header and Authorization Bearer token
 * Returns null if valid, error message string if invalid
 */
function validateApiKey(request: Request, env: Env): string | null {
	// Skip validation if API key is not configured
	if (!env.API_KEY || env.API_KEY.trim() === '') {
		return null;
	}

	const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '').trim();

	if (!apiKey) {
		return 'API key is required. Please provide X-API-Key header or Authorization Bearer token.';
	}

	if (apiKey !== env.API_KEY) {
		return 'Invalid API key.';
	}

	return null;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// CORS headers - modify if you need to restrict origins
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*', // Change to specific domain if needed
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Accept, X-API-Key, Authorization',
		};

		console.log(`[fetch] Incoming request: ${request.method} ${url.pathname}`);

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			console.log('[fetch] Matched endpoint: OPTIONS (CORS preflight)');
			return new Response(null, { headers: corsHeaders });
		}

		// Health check endpoint (no API key required)
		if (url.pathname === '/' || url.pathname === '') {
			console.log('[fetch] Matched endpoint: GET / (health check)');
			const healthResponse = {
				name: CONFIG.serverDescription,
				version: CONFIG.serverVersion,
				status: 'running',
				endpoints: {
					sse: '/sse',
					mcp: '/mcp',
				},
			};
			console.log('[fetch] Health check response:', JSON.stringify(healthResponse));
			return new Response(
				JSON.stringify(healthResponse),
				{
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders,
					},
				}
			);
		}

		// Validate API key for protected endpoints (exclude health check)
		const apiKeyError = validateApiKey(request, env);
		if (apiKeyError) {
			console.error('[fetch] API key validation failed:', apiKeyError);
			return new Response(
				JSON.stringify({
					error: 'Unauthorized',
					message: apiKeyError,
				}),
				{
					status: 401,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders,
					},
				}
			);
		}

		// SSE endpoint - GET only
		if (url.pathname === '/sse' && request.method === 'GET') {
			console.log('[fetch] Matched endpoint: GET /sse');
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
					const errorMessage = error instanceof Error ? error.message : String(error);
					const errorStack = error instanceof Error ? error.stack : undefined;
					console.error('[fetch] SSE error:', { message: errorMessage, stack: errorStack });
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
			console.log('[fetch] Matched endpoint: POST /sse');
			// Treat this as a direct message without session
			return handleMessage(request, corsHeaders, null, env, 'POST /sse');
		}

		// Messages endpoint with session
		if (url.pathname === '/sse/message' && request.method === 'POST') {
			console.log('[fetch] Matched endpoint: POST /sse/message');
			const sessionId = url.searchParams.get('sessionId');
			console.log('[fetch] SSE message session:', {
				sessionId: sessionId,
				has_session: sessions.has(sessionId || ''),
			});

			const session = sessions.get(sessionId || '') ?? null;
			return handleMessage(request, corsHeaders, session, env, 'POST /sse/message');
		}

		// MCP HTTP endpoint - POST only (streamable HTTP transport)
		if (url.pathname === '/mcp' && request.method === 'POST') {
			console.log('[fetch] Matched endpoint: POST /mcp');
			return handleMessage(request, corsHeaders, null, env, 'POST /mcp');
		}

		console.log(`[fetch] No endpoint matched for ${request.method} ${url.pathname}, returning 404`);
		return new Response('Not Found', {
			status: 404,
			headers: corsHeaders,
		});
	},
};

// Centralized message handler
async function handleMessage(
	request: Request,
	corsHeaders: Record<string, string>,
	session: Session | null,
	env: Env,
	endpoint = 'unknown'
) {
	try {
		console.log(`[handleMessage] Processing request from endpoint: ${endpoint}`);
		const body = await request.text();
		console.log('[handleMessage] Received body:', body);

		let message;
		try {
			message = JSON.parse(body);
		} catch (parseError) {
			const parseMessage = parseError instanceof Error ? parseError.message : String(parseError);
			const parseStack = parseError instanceof Error ? parseError.stack : undefined;
			console.error('[handleMessage] JSON parse error:', { message: parseMessage, stack: parseStack });
			const errorResponse = {
				jsonrpc: '2.0',
				error: {
					code: -32700,
					message: 'Parse error',
				},
			};
			console.log('[handleMessage] Sending parse error response:', JSON.stringify(errorResponse));
			return new Response(JSON.stringify(errorResponse), {
				status: 400,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders,
				},
			});
		}

		console.log('[handleMessage] Parsed MCP method:', message.method, {
			endpoint,
			message_id: message.id,
			has_params: !!message.params,
		});

		let response: Record<string, unknown> | null = null;

		// Handle initialize
		if (message.method === 'initialize') {
			console.log('[handleMessage] Handling initialize');
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
			console.log('[handleMessage] Handling tools/list');
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

			console.log('[handleMessage] Handling tools/call:', {
				tool_name: name,
				args: JSON.stringify(args),
				message_id: message.id,
				endpoint,
			});

			// Find the tool by name
			const tool = TOOLS.find((t) => t.name === name);

			console.log('[handleMessage] Tool lookup:', {
				tool_found: !!tool,
				available_tools: TOOLS.map((t) => t.name),
			});

			if (tool) {
				try {
					console.log('[handleMessage] Executing tool handler...');
					const result = await tool.handler(args, env);

					console.log('[handleMessage] Tool handler completed:', {
						has_result: !!result,
						has_content: !!result?.content,
						content_is_array: Array.isArray(result?.content),
						content_length: result?.content?.length || 0,
					});

					// Validate result structure
					if (!result) {
						console.error('[handleMessage] Tool handler returned null/undefined');
						throw new Error('Tool handler returned invalid result: null or undefined');
					}

					if (!result.content || !Array.isArray(result.content)) {
						console.error('[handleMessage] Tool handler returned invalid structure:', {
							result_type: typeof result,
							result_keys: Object.keys(result || {}),
							has_content: !!result?.content,
							content_type: typeof result?.content,
						});
						throw new Error(`Tool handler returned invalid result structure. Expected content array, got: ${JSON.stringify(result)}`);
					}

					response = {
						jsonrpc: '2.0',
						id: message.id,
						result,
					};

					console.log('[handleMessage] Response prepared successfully');
				} catch (toolError: unknown) {
					const errorMessage = toolError instanceof Error ? toolError.message : 'Tool execution failed';
					const errorStack = toolError instanceof Error ? toolError.stack : undefined;

					console.error('[handleMessage] Tool execution error:', {
						message: errorMessage,
						stack: errorStack,
						error_type: toolError?.constructor?.name || typeof toolError,
					});

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
				console.warn('[handleMessage] Unknown tool requested:', name);
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
			console.log('[handleMessage] Handling notifications/initialized (no response body)');
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		} else {
			console.warn('[handleMessage] Unknown MCP method:', message.method);
			response = {
				jsonrpc: '2.0',
				id: message.id || null,
				error: {
					code: -32601,
					message: `Method not found: ${message.method}`,
				},
			};
		}

		const responseBody = JSON.stringify(response);
		console.log('[handleMessage] Sending response:', {
			endpoint,
			mcp_method: message.method,
			response: responseBody,
		});

		// If we have a session, send via SSE
		if (session && response) {
			try {
				console.log('[handleMessage] Writing response to SSE session');
				await session.writer.write(session.encoder.encode(`data: ${responseBody}\n\n`));
			} catch (sseError) {
				const errorMessage = sseError instanceof Error ? sseError.message : String(sseError);
				const errorStack = sseError instanceof Error ? sseError.stack : undefined;
				console.error('[handleMessage] SSE write error:', { message: errorMessage, stack: errorStack });
			}
		}

		// Always return response directly for HTTP
		if (response) {
			return new Response(responseBody, {
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
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;
		console.error('[handleMessage] Message handling error:', {
			endpoint,
			message: errorMessage,
			stack: errorStack,
		});
		const errorResponse = {
			jsonrpc: '2.0',
			error: {
				code: -32603,
				message: errorMessage,
			},
		};
		console.log('[handleMessage] Sending error response:', JSON.stringify(errorResponse));
		return new Response(JSON.stringify(errorResponse), {
			status: 500,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders,
			},
		});
	}
}

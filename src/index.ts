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
			console.log('[fetch] Received POST to /sse/message:', {
				sessionId: sessionId,
				has_session: sessions.has(sessionId || ''),
			});

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

			console.log('[handleMessage] tools/call received:', {
				tool_name: name,
				args: JSON.stringify(args),
				message_id: message.id,
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

		console.log('[handleMessage] Sending response:', {
			jsonrpc: (response as any).jsonrpc,
			id: (response as any).id,
			has_result: !!(response as any).result,
			has_error: !!(response as any).error,
			error_code: (response as any).error?.code,
			error_message: (response as any).error?.message?.substring(0, 100),
			result_has_content: !!(response as any).result?.content,
			result_content_length: (response as any).result?.content?.length || 0,
			result_preview: (response as any).result ? JSON.stringify((response as any).result).substring(0, 300) : undefined,
		});

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

/**
 * ============================================================================
 * CUSTOMIZATION SECTION - Update these values for your MCP server
 * ============================================================================
 */

// Import Google Ads client functions
import {
	listAccessibleCustomers,
	executeGaqlQuery,
	getGaqlDocumentation,
	getReportingViewDocumentation,
	executeGoogleAdsMutate,
	executeUnifiedMutate,
	uploadClickConversions,
	applyRecommendations,
	dismissRecommendations,
} from './google-ads-client';

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
		properties: Record<string, any>;
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

// ─── Shared helpers ────────────────────────────────────────────────────────

function getCredentials(env: Env, loginCustomerId?: string) {
	return {
		client_id: env.GOOGLE_ADS_CLIENT_ID,
		client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
		refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
		developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
		login_customer_id: loginCustomerId || env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
	};
}

function missingCredentials(creds: ReturnType<typeof getCredentials>): string[] {
	const missing: string[] = [];
	if (!creds.client_id) missing.push('GOOGLE_ADS_CLIENT_ID');
	if (!creds.client_secret) missing.push('GOOGLE_ADS_CLIENT_SECRET');
	if (!creds.refresh_token) missing.push('GOOGLE_ADS_REFRESH_TOKEN');
	if (!creds.developer_token) missing.push('GOOGLE_ADS_DEVELOPER_TOKEN');
	return missing;
}

function errorResult(message: string): ToolResult {
	return { content: [{ type: 'text', text: JSON.stringify({ error: true, message }, null, 2) }] };
}

function successResult(data: any): ToolResult {
	return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function parseOperations(raw: unknown): { ops: any[] } | { error: string } {
	if (Array.isArray(raw)) return { ops: raw };
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) return { ops: parsed };
			return { error: 'operations must be a JSON array' };
		} catch (e) {
			return { error: `Invalid JSON in operations: ${e instanceof Error ? e.message : String(e)}` };
		}
	}
	return { error: 'operations must be a JSON array or JSON string' };
}

async function handleMutate(
	env: Env,
	resource: string,
	args: Record<string, unknown>
): Promise<ToolResult> {
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
		return successResult(result);
	} catch (e) {
		return errorResult(e instanceof Error ? e.message : String(e));
	}
}

// ─── Tool definitions ───────────────────────────────────────────────────────

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

	// ─── Phase 1: Campaign Structure ─────────────────────────────────────────

	{
		name: 'mutate_campaign_budgets',
		description:
			'Create, update, or remove Google Ads campaign budgets. ' +
			'Pass operations as a JSON array. Each operation must have exactly one of: ' +
			'"create" (object with name, amountMicros, deliveryMethod), ' +
			'"update" (object with resourceName + fields to change + updateMask sibling), ' +
			'"remove" (resource name string). ' +
			'Example create: [{"create":{"name":"My Budget","amountMicros":"50000000","deliveryMethod":"STANDARD"}}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/update/remove operations for campaignBudgets',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'campaignBudgets', args),
	},

	{
		name: 'mutate_campaigns',
		description:
			'Create, update, pause, enable, or remove Google Ads campaigns. ' +
			'Pass operations as a JSON array. Required create fields: name, status, advertisingChannelType, campaignBudget (resource name). ' +
			'Common advertisingChannelType values: SEARCH, DISPLAY, SHOPPING, VIDEO, PERFORMANCE_MAX. ' +
			'Status values: ENABLED, PAUSED, REMOVED. ' +
			'Example create: [{"create":{"name":"My Campaign","status":"ENABLED","advertisingChannelType":"SEARCH","campaignBudget":"customers/123/campaignBudgets/456","manualCpc":{"enhancedCpcEnabled":false}}}] ' +
			'Example pause: [{"update":{"resourceName":"customers/123/campaigns/456","status":"PAUSED"},"updateMask":"status"}] ' +
			'Example remove: [{"remove":"customers/123/campaigns/456"}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/update/remove operations for campaigns',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'campaigns', args),
	},

	{
		name: 'mutate_ad_groups',
		description:
			'Create, update, pause, enable, or remove Google Ads ad groups. ' +
			'Pass operations as a JSON array. Required create fields: name, campaign (resource name), status. ' +
			'Optional: type (SEARCH_STANDARD, DISPLAY_STANDARD), cpcBidMicros. ' +
			'Example create: [{"create":{"name":"My Ad Group","campaign":"customers/123/campaigns/456","status":"ENABLED","cpcBidMicros":"1000000"}}] ' +
			'Example update bid: [{"update":{"resourceName":"customers/123/adGroups/789","cpcBidMicros":"2000000"},"updateMask":"cpcBidMicros"}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/update/remove operations for adGroups',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'adGroups', args),
	},

	{
		name: 'mutate_ads',
		description:
			'Create, update, pause, enable, or remove Google Ads ads (adGroupAds). ' +
			'Supports Responsive Search Ads (RSA), Expanded Text Ads, and other ad types. ' +
			'Required create fields: adGroup (resource name), status, ad object. ' +
			'RSA requires at least 3 headlines and 2 descriptions. ' +
			'Example RSA create: [{"create":{"adGroup":"customers/123/adGroups/456","status":"ENABLED","ad":{"responsiveSearchAd":{"headlines":[{"text":"Headline 1"},{"text":"Headline 2"},{"text":"Headline 3"}],"descriptions":[{"text":"Description 1"},{"text":"Description 2"}]},"finalUrls":["https://example.com"]}}}] ' +
			'Example pause: [{"update":{"resourceName":"customers/123/adGroupAds/456~789","status":"PAUSED"},"updateMask":"status"}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/update/remove operations for adGroupAds',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'adGroupAds', args),
	},

	{
		name: 'mutate_keywords',
		description:
			'Create, update, pause, enable, or remove keywords (adGroupCriteria). ' +
			'Also handles other ad group criteria: negative keywords, placements, topics, audiences. ' +
			'Required create fields: adGroup (resource name), keyword.text, keyword.matchType. ' +
			'matchType values: BROAD, PHRASE, EXACT. ' +
			'Example add keyword: [{"create":{"adGroup":"customers/123/adGroups/456","status":"ENABLED","keyword":{"text":"plumber near me","matchType":"PHRASE"}}}] ' +
			'Example negative keyword: [{"create":{"adGroup":"customers/123/adGroups/456","negative":true,"keyword":{"text":"free","matchType":"BROAD"}}}] ' +
			'Example pause: [{"update":{"resourceName":"customers/123/adGroupCriteria/456~789","status":"PAUSED"},"updateMask":"status"}] ' +
			'Example remove: [{"remove":"customers/123/adGroupCriteria/456~789"}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/update/remove operations for adGroupCriteria',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'adGroupCriteria', args),
	},

	// ─── Phase 2: Targeting & Assets ─────────────────────────────────────────

	{
		name: 'mutate_campaign_criteria',
		description:
			'Create or remove campaign-level targeting criteria: geo targets, device bid modifiers, negative keywords, IP exclusions, ad schedules, and more. ' +
			'Required create fields: campaign (resource name) + criterion type object. ' +
			'Example geo target (add location): [{"create":{"campaign":"customers/123/campaigns/456","location":{"geoTargetConstant":"geoTargetConstants/1014044"}}}] ' +
			'Example device bid modifier: [{"create":{"campaign":"customers/123/campaigns/456","device":{"type":"MOBILE"},"bidModifier":0.8}}] ' +
			'Example campaign negative keyword: [{"create":{"campaign":"customers/123/campaigns/456","negative":true,"keyword":{"text":"free","matchType":"BROAD"}}}] ' +
			'Example remove: [{"remove":"customers/123/campaignCriteria/456~789"}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/update/remove operations for campaignCriteria',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'campaignCriteria', args),
	},

	{
		name: 'mutate_bidding_strategies',
		description:
			'Create, update, or remove portfolio bidding strategies (shared across campaigns). ' +
			'Supported types: TARGET_CPA, TARGET_ROAS, MAXIMIZE_CONVERSIONS, MAXIMIZE_CONVERSION_VALUE, TARGET_SPEND, ENHANCED_CPC. ' +
			'Example Target CPA: [{"create":{"name":"Target CPA $50","type":"TARGET_CPA","targetCpa":{"targetCpaMicros":"50000000"}}}] ' +
			'Example Target ROAS: [{"create":{"name":"Target ROAS 400%","type":"TARGET_ROAS","targetRoas":{"targetRoas":4.0}}}] ' +
			'Example Maximize Conversions: [{"create":{"name":"Max Conversions","type":"MAXIMIZE_CONVERSIONS","maximizeConversions":{}}}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/update/remove operations for biddingStrategies',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'biddingStrategies', args),
	},

	{
		name: 'mutate_ad_group_bid_modifiers',
		description:
			'Create, update, or remove ad group bid modifiers for devices, demographics, and other criteria. ' +
			'bidModifier values: 0.1 to 10.0 (set to 0 to opt out of a device entirely). ' +
			'Example mobile bid adjustment: [{"create":{"adGroup":"customers/123/adGroups/456","device":{"type":"MOBILE"},"bidModifier":1.2}}] ' +
			'Example desktop opt-out: [{"create":{"adGroup":"customers/123/adGroups/456","device":{"type":"DESKTOP"},"bidModifier":0}}] ' +
			'Example update: [{"update":{"resourceName":"customers/123/adGroupBidModifiers/456~789","bidModifier":0.9},"updateMask":"bidModifier"}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/update/remove operations for adGroupBidModifiers',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'adGroupBidModifiers', args),
	},

	{
		name: 'mutate_assets',
		description:
			'Create account-level assets: sitelinks, callouts, call assets, structured snippets, price assets, promotion assets, image assets, and more. ' +
			'Assets are created at account level then linked to campaigns/ad groups via mutate_campaign_assets. ' +
			'Example sitelink: [{"create":{"sitelinkAsset":{"linkText":"Contact Us","finalUrls":["https://example.com/contact"],"description1":"Get in touch","description2":"Available 24/7"}}}] ' +
			'Example callout: [{"create":{"calloutAsset":{"calloutText":"Free Estimates"}}}] ' +
			'Example call asset: [{"create":{"callAsset":{"phoneNumber":"555-123-4567","countryCode":"US"}}}] ' +
			'Example structured snippet: [{"create":{"structuredSnippetAsset":{"header":"Services","values":["Plumbing","HVAC","Electrical"]}}}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create operations for assets (assets are immutable once created)',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'assets', args),
	},

	{
		name: 'mutate_campaign_assets',
		description:
			'Link or unlink assets (sitelinks, callouts, call assets, etc.) to/from campaigns. ' +
			'Required create fields: campaign (resource name), asset (resource name), fieldType. ' +
			'fieldType values: SITELINK, CALLOUT, CALL, STRUCTURED_SNIPPET, PRICE, PROMOTION, IMAGE, LEAD_FORM, BUSINESS_NAME, BUSINESS_LOGO. ' +
			'Create the asset first with mutate_assets, then link it here. ' +
			'Example link sitelink: [{"create":{"campaign":"customers/123/campaigns/456","asset":"customers/123/assets/789","fieldType":"SITELINK"}}] ' +
			'Example unlink: [{"remove":"customers/123/campaignAssets/456~789~SITELINK"}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/remove operations for campaignAssets',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'campaignAssets', args),
	},

	// ─── Phase 3: Conversions & Audiences ────────────────────────────────────

	{
		name: 'mutate_conversion_actions',
		description:
			'Create, update, or remove Google Ads conversion actions (conversion tracking setup). ' +
			'type values: WEBPAGE, PHONE_CALL, IMPORT, APP_INSTALL, APP_ENGAGEMENT, STORE_VISIT, STORE_SALE, UPLOAD_CLICKS, UPLOAD_CALLS. ' +
			'countingType values: ONE_PER_CLICK, MANY_PER_CLICK. ' +
			'Example create webpage conversion: [{"create":{"name":"Contact Form Submit","type":"WEBPAGE","status":"ENABLED","countingType":"ONE_PER_CLICK","valueSettings":{"defaultValue":0,"alwaysUseDefaultValue":true},"category":"SUBMIT_LEAD_FORM"}}] ' +
			'Example create phone call conversion: [{"create":{"name":"Phone Calls","type":"PHONE_CALL","status":"ENABLED","phoneCallDurationSeconds":"60","countingType":"ONE_PER_CLICK"}}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/update/remove operations for conversionActions',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'conversionActions', args),
	},

	{
		name: 'upload_click_conversions',
		description:
			'Upload offline click conversions to Google Ads (import conversions that happened outside Google, matched via GCLID or user identifiers). ' +
			'Each conversion requires: gclid OR userIdentifiers, conversionAction (resource name), conversionDateTime, optionally conversionValue + currencyCode. ' +
			'conversionDateTime format: "2024-01-15 15:30:00-05:00" (include timezone offset). ' +
			'The conversionAction must be of type UPLOAD_CLICKS. ' +
			'Example: [{"gclid":"EAIaIQ...","conversionAction":"customers/123/conversionActions/456","conversionDateTime":"2024-01-15 10:00:00-05:00","conversionValue":199.99,"currencyCode":"USD"}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				conversions: {
					type: 'string',
					description: 'JSON array of conversion objects to upload',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some conversions to fail independently (default true)' },
			},
			required: ['customer_id', 'conversions'],
		},
		handler: async (args, env): Promise<ToolResult> => {
			const customer_id = args.customer_id as string;
			const login_customer_id = args.login_customer_id as string | undefined;
			const partial_failure = args.partial_failure !== false;

			if (!customer_id) return errorResult('customer_id is required');
			if (!args.conversions) return errorResult('conversions is required');

			const parsed = parseOperations(args.conversions);
			if ('error' in parsed) return errorResult(parsed.error);

			const creds = getCredentials(env, login_customer_id);
			const missing = missingCredentials(creds);
			if (missing.length > 0) return errorResult(`Missing required credentials: ${missing.join(', ')}`);

			try {
				const result = await uploadClickConversions(creds, customer_id, parsed.ops, login_customer_id, partial_failure);
				return successResult(result);
			} catch (e) {
				return errorResult(e instanceof Error ? e.message : String(e));
			}
		},
	},

	{
		name: 'mutate_user_lists',
		description:
			'Create, update, or remove remarketing / customer match user lists (audiences). ' +
			'List types: CRM_BASED (customer match), RULE_BASED (website visitors), LOGICAL (combined). ' +
			'membershipLifeSpan: days to keep users in list (1-540, or 10000 for no expiry). ' +
			'Example customer match list: [{"create":{"name":"My Customers","description":"Uploaded CRM list","membershipLifeSpan":"540","crmBasedUserList":{"uploadKeyType":"CONTACT_INFO","dataSourceType":"FIRST_PARTY"}}}] ' +
			'Example remarketing list: [{"create":{"name":"Website Visitors 30d","membershipLifeSpan":"30","ruleBasedUserList":{"flexibleRuleUserList":{"inclusiveRuleOperator":"AND","inclusiveOperands":[{"rule":{"ruleItemGroups":[{"ruleItems":[{"urlRuleItem":{"rule":{"type":"URL_EQUALS","value":"https://example.com"}}}]}]}}]}}}}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/update/remove operations for userLists',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'userLists', args),
	},

	// ─── Phase 4: Advanced ───────────────────────────────────────────────────

	{
		name: 'apply_recommendations',
		description:
			'Apply Google Ads recommendations (suggestions from Google to improve performance). ' +
			'First use execute_gaql to list recommendations: SELECT recommendation.resource_name, recommendation.type, recommendation.campaign FROM recommendation. ' +
			'Then pass the resource names here to apply them. ' +
			'Example: [{"resourceName":"customers/123/recommendations/abc123"}] ' +
			'Some recommendation types accept parameters in the apply operation (e.g. budget recommendations). ' +
			'Recommendations are applied asynchronously and may take a few minutes to take effect.',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of recommendation apply operations, each with a resourceName',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: async (args, env): Promise<ToolResult> => {
			const customer_id = args.customer_id as string;
			const login_customer_id = args.login_customer_id as string | undefined;

			if (!customer_id) return errorResult('customer_id is required');
			if (!args.operations) return errorResult('operations is required');

			const parsed = parseOperations(args.operations);
			if ('error' in parsed) return errorResult(parsed.error);

			const creds = getCredentials(env, login_customer_id);
			const missing = missingCredentials(creds);
			if (missing.length > 0) return errorResult(`Missing required credentials: ${missing.join(', ')}`);

			try {
				const result = await applyRecommendations(creds, customer_id, parsed.ops, login_customer_id);
				return successResult(result);
			} catch (e) {
				return errorResult(e instanceof Error ? e.message : String(e));
			}
		},
	},

	{
		name: 'dismiss_recommendations',
		description:
			'Dismiss Google Ads recommendations so they no longer appear. ' +
			'First use execute_gaql to list recommendations: SELECT recommendation.resource_name, recommendation.type FROM recommendation. ' +
			'Then pass the resource names here to dismiss them. ' +
			'Example: [{"resourceName":"customers/123/recommendations/abc123"}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of recommendation dismiss operations, each with a resourceName',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: async (args, env): Promise<ToolResult> => {
			const customer_id = args.customer_id as string;
			const login_customer_id = args.login_customer_id as string | undefined;

			if (!customer_id) return errorResult('customer_id is required');
			if (!args.operations) return errorResult('operations is required');

			const parsed = parseOperations(args.operations);
			if ('error' in parsed) return errorResult(parsed.error);

			const creds = getCredentials(env, login_customer_id);
			const missing = missingCredentials(creds);
			if (missing.length > 0) return errorResult(`Missing required credentials: ${missing.join(', ')}`);

			try {
				const result = await dismissRecommendations(creds, customer_id, parsed.ops, login_customer_id);
				return successResult(result);
			} catch (e) {
				return errorResult(e instanceof Error ? e.message : String(e));
			}
		},
	},

	{
		name: 'mutate_shared_sets',
		description:
			'Create, update, or remove shared negative keyword lists (shared sets) that can be linked to multiple campaigns. ' +
			'After creating a shared set, use execute_gaql to add keywords via sharedCriteria:mutate and link it via campaignSharedSets:mutate. ' +
			'type values: NEGATIVE_KEYWORDS, NEGATIVE_PLACEMENTS. ' +
			'Example create negative keyword list: [{"create":{"name":"Brand Negatives","type":"NEGATIVE_KEYWORDS"}}] ' +
			'Then add keywords to it: use mutate_shared_set_criteria with the new shared set resource name. ' +
			'Then link to campaigns: use mutate_campaign_shared_sets.',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/update/remove operations for sharedSets',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'sharedSets', args),
	},

	{
		name: 'mutate_shared_set_criteria',
		description:
			'Add or remove keywords/placements from a shared negative keyword list. ' +
			'Required create fields: sharedSet (resource name) + criterion type. ' +
			'Example add negative keyword to shared set: [{"create":{"sharedSet":"customers/123/sharedSets/456","keyword":{"text":"competitor brand","matchType":"BROAD"}}}] ' +
			'Example remove: [{"remove":"customers/123/sharedCriteria/456~789"}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/remove operations for sharedCriteria',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'sharedCriteria', args),
	},

	{
		name: 'mutate_campaign_shared_sets',
		description:
			'Link or unlink shared negative keyword lists to campaigns. ' +
			'Required create fields: campaign (resource name), sharedSet (resource name). ' +
			'Example link: [{"create":{"campaign":"customers/123/campaigns/456","sharedSet":"customers/123/sharedSets/789"}}] ' +
			'Example unlink: [{"remove":"customers/123/campaignSharedSets/456~789"}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				operations: {
					type: 'string',
					description: 'JSON array of create/remove operations for campaignSharedSets',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'operations'],
		},
		handler: (args, env) => handleMutate(env, 'campaignSharedSets', args),
	},

	{
		name: 'mutate_resources',
		description:
			'Atomic multi-resource mutate — create/update/remove multiple different resource types in a single API call. ' +
			'Use temporary IDs (negative integers like -1, -2) to reference resources created within the same request. ' +
			'This is the most efficient way to build campaign structures from scratch. ' +
			'mutateOperations is an array where each element wraps a single resource operation with a key like "campaignOperation", "adGroupOperation", "adGroupAdOperation", etc. ' +
			'Example create full structure: [{"campaignBudgetOperation":{"create":{"name":"Budget","amountMicros":"50000000","temporaryResourceName":"customers/123/campaignBudgets/-1"}}},{"campaignOperation":{"create":{"name":"My Campaign","status":"ENABLED","advertisingChannelType":"SEARCH","campaignBudget":"customers/123/campaignBudgets/-1","temporaryResourceName":"customers/123/campaigns/-2","manualCpc":{}}}},{"adGroupOperation":{"create":{"name":"Ad Group 1","campaign":"customers/123/campaigns/-2","status":"ENABLED","cpcBidMicros":"1000000"}}}]',
		inputSchema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: 'Google Ads customer account ID (no dashes)' },
				mutate_operations: {
					type: 'string',
					description: 'JSON array of wrapped resource operations (e.g. campaignOperation, adGroupOperation, adGroupAdOperation, adGroupCriterionOperation, etc.)',
				},
				login_customer_id: { type: 'string', description: 'Manager account ID (optional)' },
				partial_failure: { type: 'boolean', description: 'Allow some operations to fail independently (default true)' },
				validate_only: { type: 'boolean', description: 'Validate without executing (default false)' },
			},
			required: ['customer_id', 'mutate_operations'],
		},
		handler: async (args, env): Promise<ToolResult> => {
			const customer_id = args.customer_id as string;
			const login_customer_id = args.login_customer_id as string | undefined;
			const partial_failure = args.partial_failure !== false;
			const validate_only = args.validate_only === true;

			if (!customer_id) return errorResult('customer_id is required');
			if (!args.mutate_operations) return errorResult('mutate_operations is required');

			const parsed = parseOperations(args.mutate_operations);
			if ('error' in parsed) return errorResult(parsed.error);

			const creds = getCredentials(env, login_customer_id);
			const missing = missingCredentials(creds);
			if (missing.length > 0) return errorResult(`Missing required credentials: ${missing.join(', ')}`);

			try {
				const result = await executeUnifiedMutate(creds, customer_id, parsed.ops, login_customer_id, partial_failure, validate_only);
				return successResult(result);
			} catch (e) {
				return errorResult(e instanceof Error ? e.message : String(e));
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

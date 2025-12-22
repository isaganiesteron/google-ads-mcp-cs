/**
 * Google Ads API Client Helper
 * Handles authentication and provides methods to interact with Google Ads API
 * Uses REST API directly (compatible with Cloudflare Workers)
 */

interface GoogleAdsCredentials {
	client_id: string;
	client_secret: string;
	refresh_token: string;
	developer_token: string;
	login_customer_id?: string;
}

const GOOGLE_ADS_API_VERSION = 'v22';
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Validate credentials format (without logging sensitive values)
 */
function validateCredentials(credentials: GoogleAdsCredentials): void {
	if (!credentials.client_id || credentials.client_id === 'your_client_id_here' || credentials.client_id.trim() === '') {
		throw new Error('GOOGLE_ADS_CLIENT_ID is missing or not configured. Please check your .dev.vars file.');
	}
	if (!credentials.client_secret || credentials.client_secret === 'your_client_secret_here' || credentials.client_secret.trim() === '') {
		throw new Error('GOOGLE_ADS_CLIENT_SECRET is missing or not configured. Please check your .dev.vars file.');
	}
	if (!credentials.refresh_token || credentials.refresh_token === 'your_refresh_token_here' || credentials.refresh_token.trim() === '') {
		throw new Error('GOOGLE_ADS_REFRESH_TOKEN is missing or not configured. Please check your .dev.vars file.');
	}
	if (
		!credentials.developer_token ||
		credentials.developer_token === 'your_developer_token_here' ||
		credentials.developer_token.trim() === ''
	) {
		throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN is missing or not configured. Please check your .dev.vars file.');
	}
}

/**
 * Get OAuth2 access token using refresh token
 */
async function getAccessToken(credentials: GoogleAdsCredentials): Promise<string> {
	validateCredentials(credentials);

	const response = await fetch(OAUTH_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			client_id: credentials.client_id,
			client_secret: credentials.client_secret,
			refresh_token: credentials.refresh_token,
			grant_type: 'refresh_token',
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		let errorMessage = `Failed to refresh access token: ${errorText}`;

		if (errorText.includes('invalid_client')) {
			errorMessage += '\n\nPossible causes:\n';
			errorMessage += '1. Client ID or Client Secret is incorrect\n';
			errorMessage += '2. OAuth credentials are from a different Google Cloud project\n';
			errorMessage += '3. Client credentials have been deleted or disabled\n';
			errorMessage += '\nPlease verify your credentials in Google Cloud Console.';
		} else if (errorText.includes('invalid_grant')) {
			errorMessage += '\n\nPossible causes:\n';
			errorMessage += '1. Refresh token has expired or been revoked\n';
			errorMessage += '2. Refresh token is incorrect\n';
			errorMessage += '\nYou may need to regenerate your refresh token.';
		}

		throw new Error(errorMessage);
	}

	const data = (await response.json()) as { access_token: string };
	return data.access_token;
}

/**
 * Get API headers with authentication
 */
async function getApiHeaders(credentials: GoogleAdsCredentials, loginCustomerId?: string): Promise<Record<string, string>> {
	const accessToken = await getAccessToken(credentials);
	const headers: Record<string, string> = {
		Authorization: `Bearer ${accessToken}`,
		'developer-token': credentials.developer_token,
		'Content-Type': 'application/json',
	};

	if (loginCustomerId || credentials.login_customer_id) {
		const loginId = (loginCustomerId || credentials.login_customer_id)!.replace(/-/g, '');
		headers['login-customer-id'] = loginId;
	}

	return headers;
}

/**
 * Execute GAQL query using REST API
 */
async function executeGaqlQueryRest(
	credentials: GoogleAdsCredentials,
	query: string,
	customerId: string,
	loginCustomerId?: string
): Promise<any[]> {
	const customerIdClean = customerId.replace(/-/g, '');
	const url = `${GOOGLE_ADS_API_BASE}/customers/${customerIdClean}/googleAds:search`;

	const headers = await getApiHeaders(credentials, loginCustomerId);

	const requestBody = {
		query: query,
	};

	const response = await fetch(url, {
		method: 'POST',
		headers: headers,
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to execute GAQL query: ${response.status} - ${errorText.substring(0, 500)}`);
	}

	// Handle JSON response (not streaming)
	const data = (await response.json()) as { results?: any[] | any };
	if (data.results && Array.isArray(data.results)) {
		return data.results;
	} else if (data.results) {
		return [data.results];
	} else {
		return [];
	}
}

/**
 * Format accounts data for human readability and AI understanding
 * Uses clear structure with numbered list, summary, and structured data
 */
function formatAccountsForReadability(accounts: Array<{ customer_id: string; descriptive_name: string }>): string {
	if (accounts.length === 0) {
		return 'No accessible Google Ads accounts found.';
	}

	let formatted = `# Google Ads Accessible Accounts\n\n`;
	formatted += `Found ${accounts.length} accessible Google Ads account${accounts.length > 1 ? 's' : ''}:\n\n`;

	// List each account with clear formatting
	accounts.forEach((account, index) => {
		const name = account.descriptive_name || 'Unnamed Account';
		formatted += `## Account ${index + 1}: ${name}\n`;
		formatted += `- **Customer ID:** \`${account.customer_id}\`\n`;
		if (account.descriptive_name) {
			formatted += `- **Account Name:** ${account.descriptive_name}\n`;
		}
		formatted += '\n';
	});

	// Summary section for quick reference
	formatted += '---\n\n';
	formatted += `## Summary\n`;
	formatted += `- **Total Accounts:** ${accounts.length}\n`;
	formatted += `- **Customer IDs:** ${accounts.map((a) => `\`${a.customer_id}\``).join(', ')}\n`;

	// Quick reference table for AI parsing
	formatted += '\n---\n\n';
	formatted += `## Quick Reference\n`;
	formatted += `| # | Account Name | Customer ID |\n`;
	formatted += `|---|--------------|-------------|\n`;
	accounts.forEach((account, index) => {
		const name = account.descriptive_name || 'Unnamed Account';
		formatted += `| ${index + 1} | ${name} | \`${account.customer_id}\` |\n`;
	});

	return formatted;
}

/**
 * List accessible customers using the listAccessibleCustomers endpoint
 * This matches the official Google Ads MCP behavior
 * Returns only accounts directly accessible to the authenticated user
 * Includes both customer ID and descriptive name
 */
export async function listAccessibleCustomers(credentials: GoogleAdsCredentials): Promise<any> {
	try {
		const url = `${GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`;
		const headers = await getApiHeaders(credentials);

		const response = await fetch(url, {
			method: 'GET',
			headers: headers,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to list accessible customers: ${response.status} - ${errorText.substring(0, 500)}`);
		}

		const data = (await response.json()) as { resourceNames?: string[] };

		// Extract customer IDs from resource names (format: "customers/1234567890")
		const customerIds = (data.resourceNames || []).map((resourceName) => {
			return resourceName.replace('customers/', '');
		});

		// Fetch customer details (including names) for each customer ID
		// We'll query the customer resource for each ID
		const accounts = await Promise.all(
			customerIds.map(async (customerId) => {
				try {
					// Query customer resource to get descriptive name
					const customerQuery = `SELECT customer.id, customer.descriptive_name FROM customer WHERE customer.id = ${customerId}`;
					const customerResults = await executeGaqlQueryRest(credentials, customerQuery, customerId);

					// Extract customer data from results
					const customerData = customerResults[0];
					const customer = customerData?.customer || customerData;

					return {
						customer_id: customerId,
						descriptive_name: customer?.descriptiveName || customer?.descriptive_name || '',
					};
				} catch (error) {
					// If we can't fetch the name, return just the ID
					console.warn(`Failed to fetch name for customer ${customerId}:`, error);
					return {
						customer_id: customerId,
						descriptive_name: '',
					};
				}
			})
		);

		// Format for human readability and AI understanding
		const formattedText = formatAccountsForReadability(accounts);

		return {
			resourceNames: data.resourceNames || [],
			accounts: accounts,
			formatted: formattedText,
		};
	} catch (error) {
		console.error('Error listing accessible customers:', error);
		throw error;
	}
}

/**
 * Execute GAQL query
 * Uses REST API for query execution
 */
export async function executeGaqlQuery(
	credentials: GoogleAdsCredentials,
	query: string,
	customerId: string,
	loginCustomerId?: string
): Promise<any> {
	try {
		const results = await executeGaqlQueryRest(credentials, query, customerId, loginCustomerId);
		return results;
	} catch (error) {
		console.error('Error executing GAQL query:', error);
		throw error;
	}
}

/**
 * Get GAQL documentation
 * Returns documentation about Google Ads Query Language
 */
export function getGaqlDocumentation(): string {
	return JSON.stringify(
		{
			title: 'Google Ads Query Language (GAQL) Documentation',
			description: 'GAQL is a SQL-like language for querying Google Ads data',
			version: GOOGLE_ADS_API_VERSION,
			resources: [
				{
					name: 'Campaign',
					fields: ['id', 'name', 'status', 'start_date', 'end_date'],
					example: "SELECT campaign.id, campaign.name FROM campaign WHERE campaign.status = 'ENABLED'",
				},
				{
					name: 'Ad Group',
					fields: ['id', 'name', 'campaign', 'status'],
					example: 'SELECT ad_group.id, ad_group.name FROM ad_group WHERE ad_group.campaign = "customers/123/campaigns/456"',
				},
				{
					name: 'Metrics',
					common: ['impressions', 'clicks', 'cost_micros', 'conversions', 'ctr'],
					example:
						'SELECT campaign.id, metrics.impressions, metrics.clicks, metrics.ctr FROM campaign WHERE segments.date DURING LAST_30_DAYS',
				},
			],
			documentation_url: 'https://developers.google.com/google-ads/api/docs/query/overview',
			query_guide: 'https://developers.google.com/google-ads/api/docs/query/grammar',
		},
		null,
		2
	);
}

/**
 * Get reporting view documentation
 */
export function getReportingViewDocumentation(view?: string): string {
	const views: Record<string, any> = {
		campaign: {
			name: 'Campaign',
			description: 'Campaign-level reporting data',
			fields: ['campaign.id', 'campaign.name', 'campaign.status'],
			metrics: ['metrics.impressions', 'metrics.clicks', 'metrics.cost_micros'],
		},
		ad_group: {
			name: 'Ad Group',
			description: 'Ad group-level reporting data',
			fields: ['ad_group.id', 'ad_group.name', 'ad_group.status'],
			metrics: ['metrics.impressions', 'metrics.clicks', 'metrics.cost_micros'],
		},
		keyword: {
			name: 'Keyword',
			description: 'Keyword-level reporting data',
			fields: ['ad_group_criterion.keyword.text', 'ad_group_criterion.keyword.match_type'],
			metrics: ['metrics.impressions', 'metrics.clicks', 'metrics.cost_micros'],
		},
	};

	if (view && views[view.toLowerCase()]) {
		return JSON.stringify(views[view.toLowerCase()], null, 2);
	}

	return JSON.stringify(
		{
			available_views: Object.keys(views),
			views,
			documentation_url: 'https://developers.google.com/google-ads/api/docs/reporting/overview',
		},
		null,
		2
	);
}

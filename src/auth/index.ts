/**
 * Authentication module for grounded-search-mcp
 *
 * Provides the main authentication API for MCP tools including:
 * - Token validation and status
 * - OAuth login flow initiation and completion
 * - Logout functionality
 * - Provider management
 */

import {
	type AuthFlowResult,
	calculateExpiresAt,
	exchangeCodeForTokens,
	fetchUserInfo,
	startAuthFlow,
} from './device-flow.js';
import { PROVIDER_CONFIGS } from './providers.js';
import {
	deleteProviderTokens,
	loadTokens,
	saveTokens,
	updateProviderTokens,
} from './token-storage.js';
import type { AuthFlowState, ProviderName, ProviderTokens, TokenFile } from './types.js';

// Re-export types for external use
export type { AuthFlowState, ProviderName, ProviderTokens, TokenFile } from './types.js';

// Re-export token refresh functions and constants
export {
	getValidAccessToken,
	isTokenExpired,
	refreshAccessToken,
	ACCESS_TOKEN_BUFFER_MS,
	MAX_REFRESH_RETRIES,
} from './refresh.js';

/**
 * Mask an email address for display
 *
 * Format: jo***@gm***.com
 * - Local part: first 2 chars + '***'
 * - Domain name: first 2 chars + '***'
 * - TLD: unchanged
 *
 * @param email Email address to mask
 * @returns Masked email address
 */
export function maskEmail(email: string): string {
	if (!email || !email.includes('@')) {
		return '***@***.***';
	}

	const [localPart, domain] = email.split('@');

	// Handle short local parts
	const maskedLocal = localPart.length <= 2 ? `${localPart}***` : `${localPart.slice(0, 2)}***`;

	// Split domain into name and TLD
	const lastDot = domain.lastIndexOf('.');
	if (lastDot === -1) {
		// No TLD, just mask the whole domain
		const maskedDomain = domain.length <= 2 ? `${domain}***` : `${domain.slice(0, 2)}***`;
		return `${maskedLocal}@${maskedDomain}`;
	}

	const domainName = domain.slice(0, lastDot);
	const tld = domain.slice(lastDot); // includes the dot

	// Handle short domain names
	const maskedDomainName =
		domainName.length <= 2 ? `${domainName}***` : `${domainName.slice(0, 2)}***`;

	return `${maskedLocal}@${maskedDomainName}${tld}`;
}

/**
 * Check if a provider or any provider is authenticated
 *
 * @param provider Specific provider to check, or undefined to check any
 * @returns true if authenticated with valid (non-expired) tokens
 */
export async function isAuthenticated(provider?: ProviderName): Promise<boolean> {
	const tokens = await loadTokens();
	if (!tokens) return false;

	if (provider) {
		// Check specific provider
		const providerTokens = tokens[provider];
		if (!providerTokens) return false;
		return providerTokens.access_token !== undefined && providerTokens.expires_at > Date.now();
	}

	// Check any provider
	const providers: ProviderName[] = ['gemini', 'antigravity'];
	for (const p of providers) {
		const providerTokens = tokens[p];
		if (providerTokens?.access_token && providerTokens.expires_at > Date.now()) {
			return true;
		}
	}
	return false;
}

/**
 * Get the default provider
 *
 * @returns Default provider name, defaults to 'gemini' if not set
 */
export async function getDefaultProvider(): Promise<ProviderName> {
	const tokens = await loadTokens();
	return tokens?.default_provider ?? 'antigravity';
}

/**
 * Set the default provider
 *
 * @param provider Provider to set as default
 */
export async function setDefaultProvider(provider: ProviderName): Promise<void> {
	const tokens = (await loadTokens()) ?? {};
	tokens.default_provider = provider;
	await saveTokens(tokens);
}

/**
 * Provider status information
 */
export interface ProviderStatus {
	authenticated: boolean;
	email?: string;
	expiresAt?: number;
}

/**
 * Overall authentication status
 */
export interface AuthStatus {
	gemini: ProviderStatus | null;
	antigravity: ProviderStatus | null;
	defaultProvider: ProviderName;
}

/**
 * Get authentication status for all providers
 *
 * @returns Status object with provider details and default
 */
export async function getStatus(): Promise<AuthStatus> {
	const tokens = await loadTokens();

	const getProviderStatus = (providerTokens: ProviderTokens | undefined): ProviderStatus | null => {
		if (!providerTokens) return null;

		const isValid =
			providerTokens.access_token !== undefined && providerTokens.expires_at > Date.now();

		return {
			authenticated: isValid,
			email: providerTokens.email ? maskEmail(providerTokens.email) : undefined,
			expiresAt: providerTokens.expires_at,
		};
	};

	return {
		gemini: getProviderStatus(tokens?.gemini),
		antigravity: getProviderStatus(tokens?.antigravity),
		defaultProvider: tokens?.default_provider ?? 'antigravity',
	};
}

/**
 * Login result from starting an OAuth flow
 */
export interface LoginResult {
	authUrl: string;
	flowState: AuthFlowState;
}

/**
 * Start an OAuth login flow for a provider
 *
 * @param provider Provider to authenticate with
 * @returns Auth URL and flow state for later completion
 */
export async function login(provider: ProviderName): Promise<LoginResult> {
	const result: AuthFlowResult = await startAuthFlow(provider);

	const flowState: AuthFlowState = {
		codeVerifier: result.codeVerifier,
		state: result.state,
		provider: result.provider,
		expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute expiry
	};

	return {
		authUrl: result.authUrl,
		flowState,
	};
}

/**
 * Complete login result
 */
export interface CompleteLoginResult {
	success: boolean;
	email: string;
	error?: string;
}

/**
 * Complete an OAuth login flow with the authorization code
 *
 * @param code Authorization code from Google
 * @param flowState Flow state from login()
 * @returns Success status and masked email
 */
export async function completeLogin(
	code: string,
	flowState: AuthFlowState,
): Promise<CompleteLoginResult> {
	try {
		// Exchange code for tokens
		const tokenResponse = await exchangeCodeForTokens(
			code,
			flowState.codeVerifier,
			flowState.provider,
		);

		// Fetch user info
		const userInfo = await fetchUserInfo(tokenResponse.access_token);

		// Build provider tokens
		const providerTokens: ProviderTokens = {
			access_token: tokenResponse.access_token,
			refresh_token: tokenResponse.refresh_token,
			expires_at: calculateExpiresAt(tokenResponse.expires_in),
			email: userInfo.email,
		};

		// Save tokens
		await updateProviderTokens(flowState.provider, providerTokens);

		return {
			success: true,
			email: maskEmail(userInfo.email),
		};
	} catch (error) {
		return {
			success: false,
			email: '',
			error: error instanceof Error ? error.message : 'Unknown error during login',
		};
	}
}

/**
 * Logout result
 */
export interface LogoutResult {
	success: boolean;
	provider: ProviderName | 'both';
}

/**
 * Log out from one or all providers
 *
 * @param provider Provider to logout, or 'both' for all
 * @returns Success status and which provider was logged out
 */
export async function logout(provider: ProviderName | 'both'): Promise<LogoutResult> {
	if (provider === 'both') {
		await deleteProviderTokens('gemini');
		await deleteProviderTokens('antigravity');
	} else {
		await deleteProviderTokens(provider);
	}

	return {
		success: true,
		provider,
	};
}

/**
 * Get a valid access token for a provider
 *
 * @param provider Provider to get token for
 * @returns Access token if valid, null otherwise
 */
export async function getValidToken(provider?: ProviderName): Promise<string | null> {
	const tokens = await loadTokens();
	if (!tokens) return null;

	// If provider specified, check that one
	if (provider) {
		const providerTokens = tokens[provider];
		if (providerTokens?.access_token && providerTokens.expires_at > Date.now()) {
			return providerTokens.access_token;
		}
		return null;
	}

	// Otherwise check default provider first, then any
	const defaultProvider = tokens.default_provider ?? 'antigravity';
	const defaultTokens = tokens[defaultProvider];
	if (defaultTokens?.access_token && defaultTokens.expires_at > Date.now()) {
		return defaultTokens.access_token;
	}

	// Check other provider
	const otherProvider: ProviderName = defaultProvider === 'gemini' ? 'antigravity' : 'gemini';
	const otherTokens = tokens[otherProvider];
	if (otherTokens?.access_token && otherTokens.expires_at > Date.now()) {
		return otherTokens.access_token;
	}

	return null;
}

/**
 * Get provider display name
 *
 * @param provider Provider name
 * @returns Human-readable provider name
 */
export function getProviderDisplayName(provider: ProviderName): string {
	return PROVIDER_CONFIGS[provider].name;
}

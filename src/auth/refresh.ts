/**
 * Token refresh with retry logic and race condition prevention
 *
 * Provides automatic token refresh before expiry with:
 * - Exponential backoff retry on failures
 * - Promise deduplication to prevent race conditions
 * - Clear error messages for re-authentication scenarios
 */

import { PROVIDER_CONFIGS } from './providers.js';
import { getProviderTokens, updateProviderTokens } from './token-storage.js';
import type { ProviderName, ProviderTokens } from './types.js';

/**
 * Google OAuth token endpoint
 */
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Refresh token 60 seconds before expiry
 * This buffer ensures tokens are refreshed proactively
 */
export const ACCESS_TOKEN_BUFFER_MS = 60_000;

/**
 * Maximum number of refresh retry attempts
 */
export const MAX_REFRESH_RETRIES = 3;

/**
 * Base delay for exponential backoff (1 second)
 */
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Token response from refresh endpoint
 */
interface RefreshTokenResponse {
	access_token: string;
	expires_in: number;
	token_type: string;
	scope?: string;
}

/**
 * Map to track in-progress refresh operations per provider
 * Used to deduplicate concurrent refresh requests
 */
const refreshPromises = new Map<ProviderName, Promise<ProviderTokens>>();

/**
 * Check if a token is expired (or will expire within buffer period)
 *
 * @param expiresAt Token expiration timestamp in milliseconds
 * @returns true if token needs refresh (within buffer or past expiry)
 */
export function isTokenExpired(expiresAt: number): boolean {
	return Date.now() >= expiresAt - ACCESS_TOKEN_BUFFER_MS;
}

/**
 * Sleep for a specified duration
 *
 * @param ms Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate token expiration timestamp
 *
 * @param expiresIn Seconds until expiration
 * @returns Unix timestamp (milliseconds) when token expires
 */
function calculateExpiresAt(expiresIn: number): number {
	return Date.now() + expiresIn * 1000;
}

/**
 * Refresh an access token using the refresh token
 *
 * @param provider OAuth provider
 * @param refreshToken Refresh token to use
 * @returns New token response
 * @throws Error if refresh fails (invalid_grant, network error, etc.)
 */
export async function refreshAccessToken(
	provider: ProviderName,
	refreshToken: string,
): Promise<RefreshTokenResponse> {
	const config = PROVIDER_CONFIGS[provider];

	const body = new URLSearchParams({
		refresh_token: refreshToken,
		client_id: config.clientId,
		client_secret: config.clientSecret,
		grant_type: 'refresh_token',
	});

	const response = await fetch(GOOGLE_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: body.toString(),
	});

	const data = (await response.json()) as RefreshTokenResponse & {
		error?: string;
		error_description?: string;
	};

	if (!response.ok) {
		// Handle invalid_grant specifically - indicates revoked or expired refresh token
		if (data.error === 'invalid_grant') {
			throw new Error('Token revoked or expired. Re-authentication required.');
		}
		throw new Error(data.error_description || data.error || 'Token refresh failed');
	}

	return {
		access_token: data.access_token,
		expires_in: data.expires_in,
		token_type: data.token_type,
		scope: data.scope,
	};
}

/**
 * Refresh token with exponential backoff retry
 *
 * @param provider OAuth provider
 * @param refreshToken Refresh token to use
 * @returns New token response
 * @throws Error after max retries or on invalid_grant
 */
async function refreshWithRetry(
	provider: ProviderName,
	refreshToken: string,
): Promise<RefreshTokenResponse> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt < MAX_REFRESH_RETRIES; attempt++) {
		try {
			return await refreshAccessToken(provider, refreshToken);
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Don't retry on invalid_grant - token is definitively invalid
			if (lastError.message.includes('Re-authentication required')) {
				throw lastError;
			}

			// Don't retry on last attempt
			if (attempt < MAX_REFRESH_RETRIES - 1) {
				// Exponential backoff: 1s, 2s, 4s
				const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
				await sleep(delay);
			}
		}
	}

	throw new Error(
		`Max refresh retries exceeded. Re-authentication may be required. Last error: ${lastError?.message || 'Unknown'}`,
	);
}

/**
 * Get a valid access token for a provider, refreshing if necessary
 *
 * This function:
 * - Returns immediately if token is still valid
 * - Refreshes proactively if token is within buffer period
 * - Deduplicates concurrent refresh requests
 * - Updates stored tokens after successful refresh
 *
 * @param provider OAuth provider to get token for
 * @returns Valid access token, or null if not authenticated
 * @throws Error if refresh fails (suggests re-authentication)
 */
export async function getValidAccessToken(provider: ProviderName): Promise<string | null> {
	const currentTokens = await getProviderTokens(provider);

	// Not authenticated
	if (!currentTokens) {
		return null;
	}

	// Token still valid - return immediately
	if (!isTokenExpired(currentTokens.expires_at)) {
		return currentTokens.access_token;
	}

	// No refresh token - cannot refresh
	if (!currentTokens.refresh_token) {
		throw new Error('No refresh token. Re-authentication required.');
	}

	// Check if refresh already in progress for this provider
	const existingPromise = refreshPromises.get(provider);
	if (existingPromise) {
		// Wait for existing refresh to complete
		const refreshedTokens = await existingPromise;
		return refreshedTokens.access_token;
	}

	// Start new refresh, store promise for deduplication
	const refreshPromise = refreshWithRetry(provider, currentTokens.refresh_token)
		.then(async (result) => {
			// Update stored tokens with new access token and expiry
			const updatedTokens: ProviderTokens = {
				...currentTokens,
				access_token: result.access_token,
				expires_at: calculateExpiresAt(result.expires_in),
			};
			await updateProviderTokens(provider, updatedTokens);
			return updatedTokens;
		})
		.finally(() => {
			// Always remove from map to prevent stuck state
			refreshPromises.delete(provider);
		});

	refreshPromises.set(provider, refreshPromise);

	const refreshedTokens = await refreshPromise;
	return refreshedTokens.access_token;
}

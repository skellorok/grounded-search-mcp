/**
 * OAuth PKCE device code flow implementation for grounded-search-mcp
 *
 * Implements the authorization code flow with PKCE for secure OAuth
 * without client secrets being exposed in URL parameters.
 */

import crypto from 'node:crypto';
import pkceChallenge from 'pkce-challenge';
import { PROVIDER_CONFIGS } from './providers.js';
import type { ProviderName } from './types.js';

/**
 * Google OAuth endpoints
 */
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo';

/**
 * Result from starting an auth flow
 */
export interface AuthFlowResult {
	authUrl: string;
	codeVerifier: string;
	state: string;
	provider: ProviderName;
}

/**
 * Token response from Google OAuth
 */
export interface TokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
	token_type: string;
	scope: string;
}

/**
 * User info from Google OAuth
 */
export interface UserInfo {
	email: string;
	name?: string;
	picture?: string;
}

/**
 * Start an OAuth authorization flow with PKCE
 *
 * Generates a PKCE challenge and builds the authorization URL
 * with all required OAuth parameters.
 *
 * @param provider OAuth provider to authenticate with
 * @returns Auth flow state including URL for user to visit
 */
export async function startAuthFlow(provider: ProviderName): Promise<AuthFlowResult> {
	const config = PROVIDER_CONFIGS[provider];

	// Generate PKCE challenge
	const { code_verifier, code_challenge } = await pkceChallenge();

	// Generate random state for CSRF protection
	const state = crypto.randomBytes(32).toString('hex');

	// Build authorization URL
	const params = new URLSearchParams({
		client_id: config.clientId,
		redirect_uri: config.redirectUri,
		response_type: 'code',
		scope: config.scopes.join(' '),
		access_type: 'offline',
		code_challenge: code_challenge,
		code_challenge_method: 'S256',
		state: state,
		prompt: 'consent', // Forces refresh token grant
	});

	const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

	return {
		authUrl,
		codeVerifier: code_verifier,
		state,
		provider,
	};
}

/**
 * Exchange authorization code for tokens
 *
 * @param code Authorization code from Google
 * @param codeVerifier PKCE code verifier from startAuthFlow
 * @param provider OAuth provider
 * @returns Token response including access and refresh tokens
 * @throws Error if token exchange fails
 */
export async function exchangeCodeForTokens(
	code: string,
	codeVerifier: string,
	provider: ProviderName,
): Promise<TokenResponse> {
	const config = PROVIDER_CONFIGS[provider];

	const body = new URLSearchParams({
		code,
		client_id: config.clientId,
		client_secret: config.clientSecret,
		redirect_uri: config.redirectUri,
		grant_type: 'authorization_code',
		code_verifier: codeVerifier,
	});

	const response = await fetch(GOOGLE_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: body.toString(),
	});

	const data = (await response.json()) as TokenResponse & {
		error?: string;
		error_description?: string;
	};

	if (!response.ok) {
		throw new Error(data.error_description || data.error || 'Token exchange failed');
	}

	return {
		access_token: data.access_token,
		refresh_token: data.refresh_token,
		expires_in: data.expires_in,
		token_type: data.token_type,
		scope: data.scope,
	};
}

/**
 * Fetch user info from Google
 *
 * @param accessToken Valid access token
 * @returns User info including email
 * @throws Error if request fails
 */
export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
	const response = await fetch(GOOGLE_USERINFO_URL, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
	}

	const data = (await response.json()) as UserInfo;

	return {
		email: data.email,
		name: data.name,
		picture: data.picture,
	};
}

/**
 * Calculate token expiration timestamp
 *
 * @param expiresIn Seconds until expiration
 * @returns Unix timestamp (milliseconds) when token expires
 */
export function calculateExpiresAt(expiresIn: number): number {
	return Date.now() + expiresIn * 1000;
}

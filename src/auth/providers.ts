/**
 * OAuth provider configurations for gemini-search-mcp
 *
 * Contains public OAuth client credentials from Gemini CLI and OpenCode (Antigravity).
 * These are embedded in open-source code and are not secrets.
 */

import type { ProviderName } from './types.js';

/**
 * Configuration for an OAuth provider
 */
export interface ProviderConfig {
	clientId: string;
	clientSecret: string;
	scopes: string[];
	redirectUri: string;
	name: string;
}

/**
 * OAuth configurations for supported providers
 *
 * Gemini CLI: Official Google Gemini CLI credentials
 * Antigravity: OpenCode IDE credentials (more scopes, potentially higher risk)
 */
export const PROVIDER_CONFIGS: Record<ProviderName, ProviderConfig> = {
	gemini: {
		clientId: '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com',
		clientSecret: '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',
		scopes: [
			'https://www.googleapis.com/auth/cloud-platform',
			'https://www.googleapis.com/auth/userinfo.email',
			'https://www.googleapis.com/auth/userinfo.profile',
		],
		redirectUri: 'https://codeassist.google.com/authcode',
		name: 'Gemini CLI',
	},
	antigravity: {
		clientId: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
		clientSecret: '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',
		scopes: [
			'https://www.googleapis.com/auth/cloud-platform',
			'https://www.googleapis.com/auth/userinfo.email',
			'https://www.googleapis.com/auth/userinfo.profile',
			'https://www.googleapis.com/auth/cclog',
			'https://www.googleapis.com/auth/experimentsandconfigs',
		],
		redirectUri: 'https://codeassist.google.com/authcode',
		name: 'Antigravity',
	},
};

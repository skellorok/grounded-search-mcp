/**
 * Authentication types and Zod schemas for gemini-search-mcp
 * Provides type-safe token storage and auth flow state management
 */

import { z } from 'zod';

/**
 * Supported OAuth providers
 */
export type ProviderName = 'gemini' | 'antigravity';

/**
 * OAuth tokens for a single provider
 */
export interface ProviderTokens {
	access_token: string;
	refresh_token?: string;
	expires_at: number;
	email?: string;
}

/**
 * Token file structure storing credentials for all providers
 */
export interface TokenFile {
	gemini?: ProviderTokens;
	antigravity?: ProviderTokens;
	default_provider?: ProviderName;
}

/**
 * State maintained during an OAuth authorization flow
 */
export interface AuthFlowState {
	codeVerifier: string;
	state: string;
	provider: ProviderName;
	expiresAt: number;
}

// ----- Zod Schemas for Runtime Validation -----

/**
 * Schema for validating provider tokens
 */
export const ProviderTokensSchema = z.object({
	access_token: z.string(),
	refresh_token: z.string().optional(),
	expires_at: z.number(),
	email: z.string().optional(),
});

/**
 * Schema for validating the token file structure
 */
export const TokenFileSchema = z.object({
	gemini: ProviderTokensSchema.optional(),
	antigravity: ProviderTokensSchema.optional(),
	default_provider: z.enum(['gemini', 'antigravity']).optional(),
});

/**
 * Schema for validating auth flow state
 */
export const AuthFlowStateSchema = z.object({
	codeVerifier: z.string(),
	state: z.string(),
	provider: z.enum(['gemini', 'antigravity']),
	expiresAt: z.number(),
});

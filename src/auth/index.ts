/**
 * Authentication module for gemini-search-mcp
 * Phase 2: Placeholder implementation
 * Phase 3: Will implement OAuth flows with token persistence
 */

import type { AuthTokens } from '../types/index.js';

/**
 * Get stored authentication tokens
 * @returns Tokens if authenticated, null otherwise
 */
export function getTokens(): AuthTokens | null {
	// Phase 2: Always return null (not authenticated)
	// Phase 3: Will read from token storage
	return null;
}

/**
 * Check if user is authenticated
 * @returns true if valid tokens exist
 */
export function isAuthenticated(): boolean {
	return getTokens() !== null;
}

/**
 * Request building module for gemini-search-mcp
 *
 * Implements two-stage orchestration pattern that forces search grounding.
 * By including ONLY { googleSearch: {} } in tools, the model MUST search.
 */

import type { ProviderName } from '../auth/types.js';
import {
	ANTIGRAVITY_CONFIG,
	ANTIGRAVITY_DEFAULT_PROJECT_ID,
	DEFAULT_INCLUDE_THOUGHTS,
	DEFAULT_MODEL,
	DEFAULT_THINKING_LEVEL,
	GEMINI_CLI_CONFIG,
	type ProviderApiConfig,
	SEARCH_SYSTEM_INSTRUCTION,
	generateRequestId,
	generateSessionId,
	getRandomizedHeaders,
} from './constants.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for building a search request
 */
export interface SearchRequestOptions {
	/** The search query */
	query: string;
	/** Thinking level: 'high' | 'low' (default: 'low') */
	thinkingLevel?: 'high' | 'low';
	/** Include thinking process in response (default: false) */
	includeThoughts?: boolean;
}

/**
 * Core request payload structure (Stage 1)
 */
interface SearchPayload {
	systemInstruction: {
		parts: Array<{ text: string }>;
	};
	contents: Array<{
		role: 'user';
		parts: Array<{ text: string }>;
	}>;
	tools: Array<{ googleSearch: Record<string, never> }>;
	generationConfig: {
		thinkingConfig: {
			thinkingLevel: 'high' | 'low';
			includeThoughts: boolean;
		};
	};
}

/**
 * Antigravity-wrapped request (Stage 2)
 */
interface AntigravityWrappedRequest {
	project: string;
	model: string;
	userAgent: string;
	requestId: string;
	request: SearchPayload & { sessionId: string };
}

/**
 * Provider configuration with endpoint and headers
 */
export interface ProviderRequestConfig {
	endpoint: string;
	headers: Record<string, string>;
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Build the core search payload (Stage 1 of two-stage orchestration).
 *
 * CRITICAL: tools array contains ONLY { googleSearch: {} }.
 * This forces the model to search - it cannot skip to training data.
 */
function buildSearchPayload(options: SearchRequestOptions): SearchPayload {
	const {
		query,
		thinkingLevel = DEFAULT_THINKING_LEVEL,
		includeThoughts = DEFAULT_INCLUDE_THOUGHTS,
	} = options;

	return {
		systemInstruction: {
			parts: [{ text: SEARCH_SYSTEM_INSTRUCTION }],
		},
		contents: [
			{
				role: 'user',
				parts: [{ text: query }],
			},
		],
		// CRITICAL: Only googleSearch tool - forces grounding
		tools: [{ googleSearch: {} }],
		generationConfig: {
			thinkingConfig: {
				thinkingLevel,
				includeThoughts,
			},
		},
	};
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Get provider configuration (endpoint and headers).
 *
 * Uses randomized headers for rate limit avoidance.
 */
export function getProviderConfig(provider: ProviderName): ProviderRequestConfig {
	const baseConfig = provider === 'antigravity' ? ANTIGRAVITY_CONFIG : GEMINI_CLI_CONFIG;

	return {
		endpoint: baseConfig.endpoint,
		headers: getRandomizedHeaders(provider),
	};
}

/**
 * Wrap a search payload for the specific provider (Stage 2).
 *
 * - Antigravity: Wraps in { project, model, userAgent, requestId, request: { ...payload, sessionId } }
 * - Gemini CLI: Returns payload directly (no wrapping needed)
 */
export function wrapProviderRequest(
	payload: SearchPayload,
	provider: ProviderName,
	projectId?: string,
): SearchPayload | AntigravityWrappedRequest {
	if (provider === 'antigravity') {
		return {
			project: projectId ?? ANTIGRAVITY_DEFAULT_PROJECT_ID,
			model: DEFAULT_MODEL,
			userAgent: 'antigravity',
			requestId: generateRequestId(),
			request: {
				...payload,
				sessionId: generateSessionId(),
			},
		};
	}

	// Gemini CLI: use payload directly
	return payload;
}

/**
 * Build a complete search request for the specified provider.
 *
 * Combines Stage 1 (payload building) and Stage 2 (provider wrapping).
 *
 * @param options - Search request options
 * @param provider - Target provider ('gemini' | 'antigravity')
 * @param projectId - Optional project ID for Antigravity (uses default if not provided)
 * @returns Complete request body ready for JSON.stringify
 */
export function buildSearchRequest(
	options: SearchRequestOptions,
	provider: ProviderName,
	projectId?: string,
): SearchPayload | AntigravityWrappedRequest {
	const payload = buildSearchPayload(options);
	return wrapProviderRequest(payload, provider, projectId);
}

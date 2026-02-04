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
	DEFAULT_MODEL,
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
}

/**
 * Core request payload structure (Stage 1)
 * Matches Gemini CLI web-search config: base + googleSearch tool
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
		temperature: number;
		topP: number;
	};
}

/**
 * Gemini CLI wrapped request format (Stage 2)
 * Uses user_prompt_id and session_id (underscores)
 */
interface GeminiCliWrappedRequest {
	model: string;
	project: string;
	user_prompt_id: string;
	request: SearchPayload & { session_id: string };
}

/**
 * Antigravity wrapped request format (Stage 2)
 * Uses requestId and sessionId (camelCase)
 */
interface AntigravityWrappedRequest {
	project: string;
	model: string;
	userAgent: string;
	requestId: string;
	request: SearchPayload & { sessionId: string };
}

/**
 * Union type for wrapped requests
 */
type WrappedRequest = GeminiCliWrappedRequest | AntigravityWrappedRequest;

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
 *
 * Uses Gemini CLI 'base' config: temperature=0, topP=1
 */
function buildSearchPayload(options: SearchRequestOptions): SearchPayload {
	const { query } = options;

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
		// Gemini CLI 'base' config values
		generationConfig: {
			temperature: 0,
			topP: 1,
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
 * Both providers require wrapped format, but with different field names:
 * - Gemini CLI: { model, project, user_prompt_id, request: { ..., session_id } }
 * - Antigravity: { project, model, userAgent, requestId, request: { ..., sessionId } }
 */
export function wrapProviderRequest(
	payload: SearchPayload,
	provider: ProviderName,
	projectId?: string,
): WrappedRequest {
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

	// Gemini CLI: uses underscores (user_prompt_id, session_id)
	// Project ID is retrieved via loadCodeAssist before calling this function
	return {
		model: DEFAULT_MODEL,
		project: projectId ?? '',
		user_prompt_id: generateRequestId(),
		request: {
			...payload,
			session_id: generateSessionId(),
		},
	};
}

/**
 * Build a complete search request for the specified provider.
 *
 * Combines Stage 1 (payload building) and Stage 2 (provider wrapping).
 *
 * @param options - Search request options
 * @param provider - Target provider ('gemini' | 'antigravity')
 * @param projectId - Optional project ID (uses default if not provided)
 * @returns Complete request body ready for JSON.stringify
 */
export function buildSearchRequest(
	options: SearchRequestOptions,
	provider: ProviderName,
	projectId?: string,
): WrappedRequest {
	const payload = buildSearchPayload(options);
	return wrapProviderRequest(payload, provider, projectId);
}

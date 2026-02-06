/**
 * Request building module for grounded-search-mcp
 *
 * Implements two-stage orchestration pattern that forces search grounding.
 * By including ONLY { googleSearch: {} } in tools, the model MUST search.
 */

import type { ProviderName } from '../auth/types.js';
import {
	ANTIGRAVITY_CONFIG,
	ANTIGRAVITY_DEFAULT_PROJECT_ID,
	type ApiThinkingLevel,
	DEFAULT_THINKING_LEVEL,
	GEMINI_CLI_CONFIG,
	PROVIDER_MODELS,
	PROVIDER_SUPPORTS_THINKING,
	type ProviderApiConfig,
	SEARCH_SYSTEM_INSTRUCTION,
	type ThinkingLevel,
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
	/** Thinking level for Antigravity (ignored for Gemini CLI) */
	thinking?: ThinkingLevel;
}

/**
 * Generation config for providers that support thinking (Antigravity)
 */
interface ThinkingGenerationConfig {
	thinkingConfig: {
		thinkingLevel: 'high' | 'low';
		includeThoughts: boolean;
	};
}

/**
 * Generation config for providers without thinking support (Gemini CLI)
 */
interface BasicGenerationConfig {
	temperature: number;
	topP: number;
}

/**
 * Core request payload structure (Stage 1)
 * Generation config varies by provider capability
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
	generationConfig: ThinkingGenerationConfig | BasicGenerationConfig;
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
 * Generation config: temperature=0, topP=1 (both providers use gemini-2.5-flash
 * which does not support thinkingConfig)
 */
function buildSearchPayload(options: SearchRequestOptions, provider: ProviderName): SearchPayload {
	const { query, thinking } = options;

	// Determine generation config based on provider capability
	let generationConfig: ThinkingGenerationConfig | BasicGenerationConfig;

	if (PROVIDER_SUPPORTS_THINKING[provider] && thinking !== 'none') {
		// Antigravity with thinking enabled: use thinking config
		// thinking is 'high' | 'low' | undefined here (not 'none' due to condition)
		const thinkingLevel: ApiThinkingLevel =
			thinking === 'high' || thinking === 'low' ? thinking : DEFAULT_THINKING_LEVEL;
		generationConfig = {
			thinkingConfig: {
				thinkingLevel,
				includeThoughts: false,
			},
		};
	} else {
		// Gemini CLI or thinking=none: basic config without thinking
		generationConfig = {
			temperature: 0,
			topP: 1,
		};
	}

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
		generationConfig,
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
 *
 * Both providers use gemini-2.5-flash (only model with googleSearch grounding support)
 */
export function wrapProviderRequest(
	payload: SearchPayload,
	provider: ProviderName,
	projectId?: string,
): WrappedRequest {
	const model = PROVIDER_MODELS[provider];

	if (provider === 'antigravity') {
		return {
			project: projectId ?? ANTIGRAVITY_DEFAULT_PROJECT_ID,
			model,
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
		model,
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
 * @param options - Search request options (query + optional thinking level)
 * @param provider - Target provider ('gemini' | 'antigravity')
 * @param projectId - Optional project ID (uses default if not provided)
 * @returns Complete request body ready for JSON.stringify
 */
export function buildSearchRequest(
	options: SearchRequestOptions,
	provider: ProviderName,
	projectId?: string,
): WrappedRequest {
	const payload = buildSearchPayload(options, provider);
	return wrapProviderRequest(payload, provider, projectId);
}

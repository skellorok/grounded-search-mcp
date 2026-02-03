/**
 * Response types for the gemini-search-mcp server
 */

export interface SearchSource {
	title: string;
	url: string;
}

export interface SearchResponse {
	answer: string;
	model: string;
	thinking_level: string;
	sources: SearchSource[];
	searchQueries: string[];
}

export interface AuthResponse {
	success: boolean;
	provider: string;
	message: string;
}

export interface AuthTokens {
	access_token: string;
	refresh_token?: string;
	expires_at?: number;
}

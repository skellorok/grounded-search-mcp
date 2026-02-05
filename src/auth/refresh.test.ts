/**
 * Token refresh validation tests for grounded-search-mcp
 *
 * Tests:
 * - isTokenExpired() expiry detection
 * - getValidAccessToken() token retrieval and refresh
 * - Concurrent refresh deduplication (critical)
 * - Retry with exponential backoff
 * - invalid_grant error handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderName, ProviderTokens } from './types.js';

// Mock dependencies before importing the module under test
vi.mock('./token-storage.js', () => ({
	getProviderTokens: vi.fn(),
	updateProviderTokens: vi.fn(),
}));

// Import mocked functions for manipulation
import { getProviderTokens, updateProviderTokens } from './token-storage.js';

// Import module under test AFTER mocks are set up
import {
	ACCESS_TOKEN_BUFFER_MS,
	MAX_REFRESH_RETRIES,
	getValidAccessToken,
	isTokenExpired,
	refreshAccessToken,
} from './refresh.js';

// Type the mocked functions
const mockGetProviderTokens = vi.mocked(getProviderTokens);
const mockUpdateProviderTokens = vi.mocked(updateProviderTokens);

describe('isTokenExpired', () => {
	it('returns false for tokens with time remaining greater than buffer', () => {
		// Token expires in 2 minutes (well past buffer)
		const futureExpiry = Date.now() + 120_000;
		expect(isTokenExpired(futureExpiry)).toBe(false);
	});

	it('returns true for tokens expiring within buffer period (60s)', () => {
		// Token expires in 30 seconds (within buffer)
		const nearExpiry = Date.now() + 30_000;
		expect(isTokenExpired(nearExpiry)).toBe(true);
	});

	it('returns true for already expired tokens', () => {
		// Token expired 10 seconds ago
		const pastExpiry = Date.now() - 10_000;
		expect(isTokenExpired(pastExpiry)).toBe(true);
	});

	it('returns true when exactly at buffer boundary', () => {
		// Token expires exactly at buffer boundary
		const atBuffer = Date.now() + ACCESS_TOKEN_BUFFER_MS;
		expect(isTokenExpired(atBuffer)).toBe(true);
	});

	it('returns false when just past buffer boundary', () => {
		// Token expires 1ms past buffer boundary
		const pastBuffer = Date.now() + ACCESS_TOKEN_BUFFER_MS + 1;
		expect(isTokenExpired(pastBuffer)).toBe(false);
	});
});

describe('getValidAccessToken', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		// Reset global fetch mock
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns immediately for valid (non-expired) tokens', async () => {
		const validTokens: ProviderTokens = {
			access_token: 'valid-access-token',
			refresh_token: 'valid-refresh-token',
			expires_at: Date.now() + 300_000, // Expires in 5 minutes
		};
		mockGetProviderTokens.mockResolvedValue(validTokens);

		const token = await getValidAccessToken('gemini');

		expect(token).toBe('valid-access-token');
		expect(mockGetProviderTokens).toHaveBeenCalledWith('gemini');
		// fetch should NOT be called (no refresh needed)
		expect(fetch).not.toHaveBeenCalled();
	});

	it('returns null when no tokens stored', async () => {
		mockGetProviderTokens.mockResolvedValue(null);

		const token = await getValidAccessToken('antigravity');

		expect(token).toBeNull();
		expect(mockGetProviderTokens).toHaveBeenCalledWith('antigravity');
	});

	it('throws when no refresh token available', async () => {
		const tokensWithoutRefresh: ProviderTokens = {
			access_token: 'expired-token',
			expires_at: Date.now() - 10_000, // Already expired
			// No refresh_token
		};
		mockGetProviderTokens.mockResolvedValue(tokensWithoutRefresh);

		await expect(getValidAccessToken('gemini')).rejects.toThrow('No refresh token');
	});
});

describe('Concurrent refresh deduplication', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('deduplicates concurrent refresh calls - fetch called exactly once', async () => {
		// Re-import to get fresh module state (fresh refreshPromises Map)
		vi.resetModules();

		// Set up mocks before importing the fresh module
		vi.doMock('./token-storage.js', () => ({
			getProviderTokens: vi.fn().mockResolvedValue({
				access_token: 'expired-token',
				refresh_token: 'valid-refresh-token',
				expires_at: Date.now() - 10_000, // Already expired
			}),
			updateProviderTokens: vi.fn().mockResolvedValue(undefined),
		}));

		let fetchCallCount = 0;
		const mockFetch = vi.fn().mockImplementation(async () => {
			fetchCallCount++;
			// Simulate 100ms network delay
			await new Promise((resolve) => setTimeout(resolve, 100));
			return {
				ok: true,
				json: async () => ({
					access_token: 'new-access-token',
					expires_in: 3600,
					token_type: 'Bearer',
				}),
			};
		});
		vi.stubGlobal('fetch', mockFetch);

		// Import fresh module with clean state
		const { getValidAccessToken: freshGetValidAccessToken } = await import('./refresh.js');

		// Call getValidAccessToken 3 times concurrently
		const results = await Promise.all([
			freshGetValidAccessToken('gemini'),
			freshGetValidAccessToken('gemini'),
			freshGetValidAccessToken('gemini'),
		]);

		// All 3 calls should return the same new token
		expect(results[0]).toBe('new-access-token');
		expect(results[1]).toBe('new-access-token');
		expect(results[2]).toBe('new-access-token');

		// fetch should be called exactly ONCE (deduplication works)
		expect(fetchCallCount).toBe(1);
	});
});

describe('Retry with exponential backoff', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('retries refresh on network error and succeeds on 3rd attempt', async () => {
		vi.resetModules();

		vi.doMock('./token-storage.js', () => ({
			getProviderTokens: vi.fn().mockResolvedValue({
				access_token: 'expired-token',
				refresh_token: 'valid-refresh-token',
				expires_at: Date.now() - 10_000,
			}),
			updateProviderTokens: vi.fn().mockResolvedValue(undefined),
		}));

		let attemptCount = 0;
		const mockFetch = vi.fn().mockImplementation(async () => {
			attemptCount++;
			if (attemptCount < 3) {
				// First 2 attempts fail with network error
				throw new Error('Network error');
			}
			// 3rd attempt succeeds
			return {
				ok: true,
				json: async () => ({
					access_token: 'success-token-after-retry',
					expires_in: 3600,
					token_type: 'Bearer',
				}),
			};
		});
		vi.stubGlobal('fetch', mockFetch);

		const { getValidAccessToken: freshGetValidAccessToken } = await import('./refresh.js');

		const token = await freshGetValidAccessToken('gemini');

		expect(token).toBe('success-token-after-retry');
		expect(attemptCount).toBe(3);
	}, 15000); // Increase timeout for backoff delays

	it('fails after max retries exceeded', async () => {
		vi.resetModules();

		vi.doMock('./token-storage.js', () => ({
			getProviderTokens: vi.fn().mockResolvedValue({
				access_token: 'expired-token',
				refresh_token: 'valid-refresh-token',
				expires_at: Date.now() - 10_000,
			}),
			updateProviderTokens: vi.fn().mockResolvedValue(undefined),
		}));

		let attemptCount = 0;
		const mockFetch = vi.fn().mockImplementation(async () => {
			attemptCount++;
			throw new Error('Persistent network error');
		});
		vi.stubGlobal('fetch', mockFetch);

		const { getValidAccessToken: freshGetValidAccessToken } = await import('./refresh.js');

		await expect(freshGetValidAccessToken('gemini')).rejects.toThrow(
			'Max refresh retries exceeded',
		);
		expect(attemptCount).toBe(MAX_REFRESH_RETRIES);
	}, 15000); // Increase timeout for backoff delays
});

describe('invalid_grant handling', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('throws immediately on invalid_grant without retry', async () => {
		vi.resetModules();

		vi.doMock('./token-storage.js', () => ({
			getProviderTokens: vi.fn().mockResolvedValue({
				access_token: 'expired-token',
				refresh_token: 'revoked-refresh-token',
				expires_at: Date.now() - 10_000,
			}),
			updateProviderTokens: vi.fn().mockResolvedValue(undefined),
		}));

		let fetchCallCount = 0;
		const mockFetch = vi.fn().mockImplementation(async () => {
			fetchCallCount++;
			return {
				ok: false,
				json: async () => ({
					error: 'invalid_grant',
					error_description: 'Token has been expired or revoked.',
				}),
			};
		});
		vi.stubGlobal('fetch', mockFetch);

		const { getValidAccessToken: freshGetValidAccessToken } = await import('./refresh.js');

		await expect(freshGetValidAccessToken('gemini')).rejects.toThrow('Re-authentication required');
		// Should NOT retry on invalid_grant
		expect(fetchCallCount).toBe(1);
	});

	it('error message contains re-authentication instruction', async () => {
		vi.resetModules();

		vi.doMock('./token-storage.js', () => ({
			getProviderTokens: vi.fn().mockResolvedValue({
				access_token: 'expired-token',
				refresh_token: 'revoked-refresh-token',
				expires_at: Date.now() - 10_000,
			}),
			updateProviderTokens: vi.fn().mockResolvedValue(undefined),
		}));

		const mockFetch = vi.fn().mockImplementation(async () => ({
			ok: false,
			json: async () => ({
				error: 'invalid_grant',
			}),
		}));
		vi.stubGlobal('fetch', mockFetch);

		const { getValidAccessToken: freshGetValidAccessToken } = await import('./refresh.js');

		try {
			await freshGetValidAccessToken('antigravity');
			expect.fail('Should have thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toContain('Re-authentication required');
		}
	});
});

describe('refreshAccessToken', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('makes correct request to Google token endpoint', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				access_token: 'new-token',
				expires_in: 3600,
				token_type: 'Bearer',
				scope: 'https://www.googleapis.com/auth/cloud-platform',
			}),
		});
		vi.stubGlobal('fetch', mockFetch);

		const result = await refreshAccessToken('gemini', 'test-refresh-token');

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, options] = mockFetch.mock.calls[0];

		expect(url).toBe('https://oauth2.googleapis.com/token');
		expect(options.method).toBe('POST');
		expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

		// Verify body contains correct parameters
		const body = options.body;
		expect(body).toContain('grant_type=refresh_token');
		expect(body).toContain('refresh_token=test-refresh-token');
		expect(body).toContain('client_id='); // Contains Gemini client ID

		expect(result.access_token).toBe('new-token');
		expect(result.expires_in).toBe(3600);
	});

	it('uses correct client credentials for each provider', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				access_token: 'token',
				expires_in: 3600,
				token_type: 'Bearer',
			}),
		});
		vi.stubGlobal('fetch', mockFetch);

		// Test Gemini provider
		await refreshAccessToken('gemini', 'refresh-token');
		const geminiBody = mockFetch.mock.calls[0][1].body;
		expect(geminiBody).toContain('681255809395'); // Gemini client ID prefix

		mockFetch.mockClear();

		// Test Antigravity provider
		await refreshAccessToken('antigravity', 'refresh-token');
		const antigravityBody = mockFetch.mock.calls[0][1].body;
		expect(antigravityBody).toContain('1071006060591'); // Antigravity client ID prefix
	});
});

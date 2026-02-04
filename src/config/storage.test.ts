/**
 * Config storage validation tests for gemini-search-mcp
 *
 * Tests:
 * - loadConfig() returns defaults on missing file
 * - loadConfig() returns defaults on corrupt JSON
 * - loadConfig() returns defaults on Zod validation failure
 * - loadConfig() returns parsed config for valid file
 * - saveConfig() creates directory and writes atomically
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from './defaults.js';

// Mock fs/promises before importing module under test
vi.mock('node:fs/promises', () => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
	rename: vi.fn(),
	mkdir: vi.fn(),
}));

// Import mocked functions
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';

// Import module under test after mocks
import { getConfigFilePath, loadConfig, saveConfig } from './storage.js';

// Type the mocked functions
const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockRename = vi.mocked(rename);
const mockMkdir = vi.mocked(mkdir);

describe('loadConfig', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock saveConfig's file operations for ENOENT case
		mockMkdir.mockResolvedValue(undefined);
		mockWriteFile.mockResolvedValue(undefined);
		mockRename.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns defaults and creates file when file doesn't exist", async () => {
		const error = new Error('ENOENT') as NodeJS.ErrnoException;
		error.code = 'ENOENT';
		mockReadFile.mockRejectedValue(error);

		const config = await loadConfig();

		// Should return DEFAULT_CONFIG
		expect(config).toEqual(DEFAULT_CONFIG);
		// Should have attempted to save defaults
		expect(mockWriteFile).toHaveBeenCalled();
	});

	it('returns defaults on corrupt JSON', async () => {
		mockReadFile.mockResolvedValue('{ invalid json }');

		// Silence console.error for this test
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const config = await loadConfig();

		expect(config).toEqual(DEFAULT_CONFIG);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('parse error'),
			expect.anything(),
		);

		consoleSpy.mockRestore();
	});

	it('returns defaults on Zod validation failure', async () => {
		// Valid JSON but invalid values
		mockReadFile.mockResolvedValue(
			JSON.stringify({
				version: -1, // Invalid: must be positive
				defaultProvider: 'invalid-provider', // Invalid enum
				timeout: 500, // Invalid: below minimum 1000
			}),
		);

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const config = await loadConfig();

		expect(config).toEqual(DEFAULT_CONFIG);
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('invalid'), expect.anything());

		consoleSpy.mockRestore();
	});

	it('returns parsed config for valid file', async () => {
		const validConfig = {
			version: 1,
			defaultProvider: 'gemini',
			defaultThinking: 'low',
			includeThoughts: true,
			timeout: 30000,
			verbose: true,
		};
		mockReadFile.mockResolvedValue(JSON.stringify(validConfig));

		const config = await loadConfig();

		expect(config).toEqual(validConfig);
	});

	it('applies defaults for missing optional fields', async () => {
		// Partial config - only some fields
		const partialConfig = {
			defaultProvider: 'gemini',
		};
		mockReadFile.mockResolvedValue(JSON.stringify(partialConfig));

		const config = await loadConfig();

		// Should have gemini as provider but defaults for other fields
		expect(config.defaultProvider).toBe('gemini');
		expect(config.version).toBe(DEFAULT_CONFIG.version);
		expect(config.defaultThinking).toBe(DEFAULT_CONFIG.defaultThinking);
		expect(config.timeout).toBe(DEFAULT_CONFIG.timeout);
	});
});

describe('saveConfig', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockMkdir.mockResolvedValue(undefined);
		mockWriteFile.mockResolvedValue(undefined);
		mockRename.mockResolvedValue(undefined);
	});

	it('creates directory with recursive and mode 0o700', async () => {
		await saveConfig(DEFAULT_CONFIG);

		expect(mockMkdir).toHaveBeenCalledWith(expect.any(String), {
			recursive: true,
			mode: 0o700,
		});
	});

	it('writes to temp file with mode 0o600', async () => {
		await saveConfig(DEFAULT_CONFIG);

		// writeFile should be called with .tmp path
		const writeCall = mockWriteFile.mock.calls[0];
		expect(writeCall[0]).toMatch(/\.tmp$/);
		expect(writeCall[2]).toEqual({ mode: 0o600 });
	});

	it('performs atomic rename from temp to final path', async () => {
		const configPath = getConfigFilePath();
		await saveConfig(DEFAULT_CONFIG);

		// rename should be called from .tmp to config path
		expect(mockRename).toHaveBeenCalledWith(`${configPath}.tmp`, configPath);
	});

	it('writes pretty-printed JSON with 2-space indent', async () => {
		await saveConfig(DEFAULT_CONFIG);

		const writeCall = mockWriteFile.mock.calls[0];
		const writtenContent = writeCall[1] as string;

		// Should be pretty-printed (has newlines and spaces)
		expect(writtenContent).toContain('\n');
		expect(writtenContent).toContain('  '); // 2-space indent

		// Should be valid JSON
		const parsed = JSON.parse(writtenContent);
		expect(parsed).toEqual(DEFAULT_CONFIG);
	});
});

describe('getConfigFilePath', () => {
	it('returns path ending in config.json', () => {
		const path = getConfigFilePath();
		expect(path).toMatch(/config\.json$/);
	});

	it('includes google-search-mcp directory', () => {
		const path = getConfigFilePath();
		expect(path).toContain('google-search-mcp');
	});
});

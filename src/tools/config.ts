/**
 * config tool for gemini-search-mcp
 *
 * Provides flag-based configuration management:
 * - config --show: Show all current settings
 * - config --get <key>: Get specific config value
 * - config --set key=value [...]: Set one or more config values
 * - config --reset [key]: Reset all or specific key to defaults
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
	CONFIGURABLE_KEYS,
	CONFIG_KEYS,
	type ConfigFile,
	type ConfigurableKey,
	DEFAULT_CONFIG,
	loadConfig,
	resetConfig,
	saveConfig,
} from '../config/index.js';

// ============================================================================
// FORMATTING FUNCTIONS (plain text for terminal display)
// ============================================================================

/**
 * Format config for --show output
 */
function formatShowConfig(config: ConfigFile): string {
	const lines: string[] = ['CONFIGURATION', '═'.repeat(50), ''];

	for (const key of CONFIGURABLE_KEYS) {
		const keyInfo = CONFIG_KEYS[key];
		const currentValue = config[key];
		const defaultValue = keyInfo.default;
		const isDefault = currentValue === defaultValue;

		lines.push(`${key}`);
		lines.push(`  Current: ${currentValue}${isDefault ? ' (default)' : ''}`);
		lines.push(`  Default: ${defaultValue}`);

		if (keyInfo.type === 'enum' && 'values' in keyInfo) {
			lines.push(`  Valid:   ${keyInfo.values.join(', ')}`);
		} else if (keyInfo.type === 'number' && 'min' in keyInfo && 'max' in keyInfo) {
			lines.push(`  Range:   ${keyInfo.min} - ${keyInfo.max}`);
		} else if (keyInfo.type === 'boolean') {
			lines.push('  Valid:   true, false');
		}

		lines.push(`  ${keyInfo.description}`);
		lines.push('');
	}

	return lines.join('\n');
}

/**
 * Format result for --get
 */
function formatGetResult(key: string, value: unknown): string {
	const keyInfo = CONFIG_KEYS[key as keyof typeof CONFIG_KEYS];
	const description = keyInfo?.description ?? '';

	return `${key} = ${value}

${description}`;
}

/**
 * Format success message for --set
 */
function formatSetSuccess(changes: Array<{ key: string; value: unknown }>): string {
	const lines: string[] = ['Configuration updated:', ''];

	for (const { key, value } of changes) {
		lines.push(`  ${key} = ${value}`);
	}

	return lines.join('\n');
}

/**
 * Format success message for --reset
 */
function formatResetSuccess(key?: string): string {
	if (key) {
		return `Reset ${key} to default: ${DEFAULT_CONFIG[key as keyof ConfigFile]}`;
	}

	return 'All settings reset to defaults.';
}

/**
 * Format help text
 */
function formatHelp(): string {
	return `Config Tool - Manage search preferences

Usage:
  config --show              Show all settings
  config --get <key>         Get specific value
  config --set key=value     Set value(s)
  config --reset             Reset all to defaults
  config --reset <key>       Reset specific key

Keys:
  defaultProvider   antigravity | gemini
  defaultThinking   high | low | none
  includeThoughts   true | false
  timeout           1000-300000 (ms)
  verbose           true | false

Examples:
  config --set defaultProvider=gemini
  config --set defaultThinking=low timeout=30000
  config --get defaultProvider`;
}

/**
 * Format error message
 */
function formatError(message: string): string {
	return `Error: ${message}`;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Parse key=value string
 */
function parseKeyValue(input: string): { key: string; value: string } | null {
	const eqIndex = input.indexOf('=');
	if (eqIndex === -1) {
		return null;
	}

	const key = input.substring(0, eqIndex).trim();
	const value = input.substring(eqIndex + 1).trim();

	return { key, value };
}

/**
 * Validate and parse a config value
 */
function validateAndParseValue(
	key: string,
	value: string,
): { success: true; parsed: unknown } | { success: false; error: string } {
	// Check if key is valid
	if (!CONFIGURABLE_KEYS.includes(key as ConfigurableKey)) {
		const validKeys = CONFIGURABLE_KEYS.join(', ');
		return {
			success: false,
			error: `Invalid key '${key}'. Valid keys: ${validKeys}`,
		};
	}

	const keyInfo = CONFIG_KEYS[key as keyof typeof CONFIG_KEYS];

	// Parse based on type
	if (keyInfo.type === 'enum' && 'values' in keyInfo) {
		const validValues = keyInfo.values as readonly string[];
		if (!validValues.includes(value)) {
			return {
				success: false,
				error: `Invalid value '${value}' for ${key}. Valid values: ${validValues.join(', ')}`,
			};
		}
		return { success: true, parsed: value };
	}

	if (keyInfo.type === 'boolean') {
		if (value === 'true') {
			return { success: true, parsed: true };
		}
		if (value === 'false') {
			return { success: true, parsed: false };
		}
		return {
			success: false,
			error: `Invalid value '${value}' for ${key}. Must be 'true' or 'false'.`,
		};
	}

	if (keyInfo.type === 'number' && 'min' in keyInfo && 'max' in keyInfo) {
		const num = Number(value);
		if (Number.isNaN(num) || !Number.isInteger(num)) {
			return {
				success: false,
				error: `Invalid value '${value}' for ${key}. Must be an integer.`,
			};
		}
		if (num < keyInfo.min || num > keyInfo.max) {
			return {
				success: false,
				error: `Invalid value '${value}' for ${key}. Must be between ${keyInfo.min} and ${keyInfo.max}.`,
			};
		}
		return { success: true, parsed: num };
	}

	return { success: false, error: `Unknown type for key '${key}'` };
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register the config tool with the MCP server
 */
export function registerConfigTool(server: McpServer): void {
	server.tool(
		'config',
		'Manage search configuration preferences',
		{
			show: z
				.boolean()
				.optional()
				.describe('Show all current settings with defaults and valid options'),
			get: z.string().optional().describe('Get specific config value by key'),
			set: z
				.array(z.string())
				.optional()
				.describe('Set config values in key=value format (supports multiple)'),
			reset: z
				.union([z.boolean(), z.string()])
				.optional()
				.describe('Reset all (true) or specific key (string) to defaults'),
		},
		async (params) => {
			const { show, get: getKey, set: setValues, reset: resetValue } = params;

			try {
				// Handle --show
				if (show) {
					const config = await loadConfig();
					return {
						content: [{ type: 'text', text: formatShowConfig(config) }],
					};
				}

				// Handle --get
				if (getKey) {
					if (!CONFIGURABLE_KEYS.includes(getKey as ConfigurableKey)) {
						const validKeys = CONFIGURABLE_KEYS.join(', ');
						return {
							content: [
								{
									type: 'text',
									text: formatError(`Invalid key '${getKey}'. Valid keys: ${validKeys}`),
								},
							],
							isError: true,
						};
					}

					const config = await loadConfig();
					const value = config[getKey as keyof ConfigFile];
					return {
						content: [{ type: 'text', text: formatGetResult(getKey, value) }],
					};
				}

				// Handle --reset
				if (resetValue !== undefined) {
					if (typeof resetValue === 'string') {
						// Reset specific key
						if (!CONFIGURABLE_KEYS.includes(resetValue as ConfigurableKey)) {
							const validKeys = CONFIGURABLE_KEYS.join(', ');
							return {
								content: [
									{
										type: 'text',
										text: formatError(`Invalid key '${resetValue}'. Valid keys: ${validKeys}`),
									},
								],
								isError: true,
							};
						}

						await resetConfig(resetValue as keyof ConfigFile);
						return {
							content: [{ type: 'text', text: formatResetSuccess(resetValue) }],
						};
					}

					// Reset all (resetValue is true)
					await resetConfig();
					return {
						content: [{ type: 'text', text: formatResetSuccess() }],
					};
				}

				// Handle --set
				if (setValues && setValues.length > 0) {
					const changes: Array<{ key: string; value: unknown }> = [];
					const updates: Partial<ConfigFile> = {};

					for (const kv of setValues) {
						const parsed = parseKeyValue(kv);
						if (!parsed) {
							return {
								content: [
									{
										type: 'text',
										text: formatError(
											`Invalid format '${kv}'. Use key=value format (e.g., defaultProvider=gemini).`,
										),
									},
								],
								isError: true,
							};
						}

						const result = validateAndParseValue(parsed.key, parsed.value);
						if (!result.success) {
							return {
								content: [{ type: 'text', text: formatError(result.error) }],
								isError: true,
							};
						}

						// Type-safe assignment using the key
						(updates as Record<string, unknown>)[parsed.key] = result.parsed;
						changes.push({ key: parsed.key, value: result.parsed });
					}

					// Load current config, merge, and save
					const current = await loadConfig();
					const merged = { ...current, ...updates };
					await saveConfig(merged as ConfigFile);

					return {
						content: [{ type: 'text', text: formatSetSuccess(changes) }],
					};
				}

				// No flags - show help
				return {
					content: [{ type: 'text', text: formatHelp() }],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				return {
					content: [{ type: 'text', text: formatError(message) }],
					isError: true,
				};
			}
		},
	);
}

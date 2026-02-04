/**
 * Default configuration values and constants for gemini-search-mcp
 */

import { type ConfigFile, ConfigFileSchema } from './types.js';

/**
 * Current config schema version for migration support
 */
export const CURRENT_CONFIG_VERSION = 1;

/**
 * Default config values generated from schema
 * All fields have their default values applied
 */
export const DEFAULT_CONFIG: ConfigFile = ConfigFileSchema.parse({});

/**
 * Valid values for each config key
 * Used for --show display and validation error messages
 */
export const CONFIG_KEYS = {
	version: {
		description: 'Config schema version',
		type: 'number',
		default: 1,
		readonly: true,
	},
	defaultProvider: {
		description: 'Default search provider',
		type: 'enum',
		values: ['antigravity', 'gemini'] as const,
		default: 'antigravity',
	},
	defaultThinking: {
		description: 'Default thinking level for searches',
		type: 'enum',
		values: ['high', 'low', 'none'] as const,
		default: 'high',
	},
	includeThoughts: {
		description: 'Include model thinking in responses',
		type: 'boolean',
		values: [true, false] as const,
		default: false,
	},
	timeout: {
		description: 'Search timeout in milliseconds',
		type: 'number',
		min: 1000,
		max: 300000,
		default: 60000,
	},
	verbose: {
		description: 'Enable verbose output with response time',
		type: 'boolean',
		values: [true, false] as const,
		default: false,
	},
} as const;

/**
 * List of user-configurable keys (excludes version)
 */
export const CONFIGURABLE_KEYS = [
	'defaultProvider',
	'defaultThinking',
	'includeThoughts',
	'timeout',
	'verbose',
] as const;

export type ConfigurableKey = (typeof CONFIGURABLE_KEYS)[number];

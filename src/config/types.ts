/**
 * Configuration types and Zod schemas for gemini-search-mcp
 * Provides type-safe config file validation with defaults
 */

import { z } from 'zod';

/**
 * Schema for validating the config file structure
 *
 * All fields have defaults, so an empty object {} is valid.
 * Uses custom error messages for enum fields.
 */
export const ConfigFileSchema = z.object({
	version: z.number().int().positive().default(1),
	defaultProvider: z
		.enum(['antigravity', 'gemini'], {
			errorMap: () => ({ message: "Must be 'antigravity' or 'gemini'" }),
		})
		.default('antigravity'),
	defaultThinking: z
		.enum(['high', 'low', 'none'], {
			errorMap: () => ({ message: "Must be 'high', 'low', or 'none'" }),
		})
		.default('high'),
	includeThoughts: z.boolean().default(false),
	timeout: z.number().int().min(1000).max(300000).default(60000),
	verbose: z.boolean().default(false),
});

/**
 * Config file type inferred from schema
 */
export type ConfigFile = z.infer<typeof ConfigFileSchema>;

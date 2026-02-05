/**
 * Config module exports for grounded-search-mcp
 */

// Types
export { type ConfigFile, ConfigFileSchema } from './types.js';

// Defaults
export {
	CURRENT_CONFIG_VERSION,
	DEFAULT_CONFIG,
	CONFIG_KEYS,
	CONFIGURABLE_KEYS,
	type ConfigurableKey,
} from './defaults.js';

// Storage
export {
	getConfigFilePath,
	loadConfig,
	saveConfig,
	updateConfig,
	resetConfig,
} from './storage.js';

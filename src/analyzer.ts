/**
 * Rust Solo - Cargo.toml generation and rust-analyzer synchronization
 *
 * This module generates a dynamic Cargo.toml workspace for standalone Rust files,
 * enabling rust-analyzer to provide full diagnostics (cargo check), run, and debug
 * capabilities without requiring a traditional Cargo workspace.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const CACHE_DIR_NAME = 'rust_solo_cache';
const PROJECT_FILE_NAME = 'Cargo.toml';
const DEFAULT_MAX_RELOAD_RETRIES = 16;
const DEFAULT_RELOAD_RETRY_INTERVAL_MS = 500;

/**
 * Synchronizes the rust-analyzer project configuration with the current LRU cache.
 *
 * Generates a Cargo.toml in `.vscode/rust_solo_cache/` containing all cached files
 * as `[[bin]]` targets, then updates rust-analyzer's `linkedProjects` setting.
 *
 * When the cache is empty, cleans up all generated files and removes the project link.
 */
export async function syncRustProject(lruCache: string[]) {
	const wsFolders = vscode.workspace.workspaceFolders;
	if (!wsFolders || wsFolders.length === 0) {
		return;
	}

	const workspacePath = wsFolders[0].uri.fsPath;
	const cacheDir = path.join(workspacePath, '.vscode', CACHE_DIR_NAME);
	const cacheFilePath = path.join(cacheDir, PROJECT_FILE_NAME);
	const relativeCacheFile = `.vscode/${CACHE_DIR_NAME}/${PROJECT_FILE_NAME}`;

	const raConfig = vscode.workspace.getConfiguration('rust-analyzer');
	let linkedProjects = [...(raConfig.get<any[]>('linkedProjects') || [])];
	let shouldReloadRustAnalyzer = false;

	if (lruCache.length > 0) {
		if (!fs.existsSync(cacheDir)) {
			fs.mkdirSync(cacheDir, { recursive: true });
		}

		const cargoTomlContent = generateCargoToml(lruCache);
		fs.writeFileSync(cacheFilePath, cargoTomlContent, 'utf8');
		shouldReloadRustAnalyzer = true;

		if (!linkedProjects.includes(relativeCacheFile)) {
			linkedProjects.push(relativeCacheFile);
			await raConfig.update('linkedProjects', linkedProjects, vscode.ConfigurationTarget.Workspace);
		}
	} else {
		if (fs.existsSync(cacheFilePath)) {
			fs.unlinkSync(cacheFilePath);
			shouldReloadRustAnalyzer = true;
		}
		// Clean up Cargo.lock if it exists
		const cargoLockPath = path.join(cacheDir, 'Cargo.lock');
		if (fs.existsSync(cargoLockPath)) {
			try { fs.unlinkSync(cargoLockPath); } catch (e) { }
		}
		// Clean up target directory if it exists
		const targetDir = path.join(cacheDir, 'target');
		if (fs.existsSync(targetDir)) {
			try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch (e) { }
		}
		if (fs.existsSync(cacheDir)) {
			try { fs.rmdirSync(cacheDir); } catch (e) { }
		}

		if (linkedProjects.includes(relativeCacheFile)) {
			linkedProjects = linkedProjects.filter(p => p !== relativeCacheFile);
			const newValue = linkedProjects.length > 0 ? linkedProjects : undefined;
			await raConfig.update('linkedProjects', newValue, vscode.ConfigurationTarget.Workspace);
		}
	}

	if (shouldReloadRustAnalyzer) {
		await triggerAnalyzerReload();
	}
}

/**
 * Triggers rust-analyzer to reload its workspace configuration.
 *
 * Uses retry logic because rust-analyzer may not be immediately available
 * after activation, especially during VS Code startup.
 */
async function triggerAnalyzerReload() {
	const raExtension = vscode.extensions.getExtension('rust-lang.rust-analyzer');
	if (!raExtension) {
		return;
	}

	if (!raExtension.isActive) {
		await raExtension.activate();
	}

	const config = vscode.workspace.getConfiguration('rustSolo');
	const maxRetries = config.get<number>('reloadMaxRetries', DEFAULT_MAX_RELOAD_RETRIES);
	const retryDelayMs = config.get<number>('reloadRetryDelayMs', DEFAULT_RELOAD_RETRY_INTERVAL_MS);

	(async () => {
		for (let i = 0; i < maxRetries; i++) {
			const commands = await vscode.commands.getCommands(true);
			if (commands.includes('rust-analyzer.reloadWorkspace')) {
				try {
					await vscode.commands.executeCommand('rust-analyzer.reloadWorkspace');
				} catch (e) { }
				break;
			}
			await new Promise(resolve => setTimeout(resolve, retryDelayMs));
		}
	})();
}

/**
 * Generates a Cargo.toml content string with each file as a `[[bin]]` target.
 *
 * Binary names are made unique using a hash of the file path to prevent
 * conflicts when multiple files have the same basename.
 *
 * Example output:
 * ```toml
 * [package]
 * name = "rust_solo_workspace"
 * version = "0.1.0"
 * edition = "2021"
 *
 * [[bin]]
 * name = "main_abc12345"
 * path = "/path/to/main.rs"
 *
 * [dependencies]
 * ```
 */
function generateCargoToml(filePaths: string[]): string {
	const bins = filePaths.map(filePath => {
		const hash = crypto.createHash('md5').update(filePath).digest('hex').substring(0, 8);
		const baseName = path.basename(filePath, '.rs').replace(/[^a-zA-Z0-9_]/g, '_');
		const binName = `${baseName}_${hash}`;
		return { name: binName, path: filePath };
	});

	let toml = `[package]
name = "rust_solo_workspace"
version = "0.1.0"
edition = "2021"

`;

	for (const bin of bins) {
		toml += `[[bin]]
name = "${bin.name}"
path = "${bin.path.replace(/\\/g, '/')}"

`;
	}

	toml += `[dependencies]
`;

	return toml;
}

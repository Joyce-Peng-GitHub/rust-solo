import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getSysrootSrc } from './sysroot';

const CACHE_DIR_NAME = 'rust_solo_cache';
const PROJECT_FILE_NAME = 'rust-project.json';
const DEFAULT_MAX_RELOAD_RETRIES = 16;
const DEFAULT_RELOAD_RETRY_INTERVAL_MS = 500;

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

		const projectJson = {
			sysroot_src: getSysrootSrc(),
			crates: lruCache.map(filePath => ({
				root_module: filePath,
				edition: "2021",
				deps: [],
				is_workspace_member: true,
				cfg: ["test", "debug_assertions"]
			}))
		};

		fs.writeFileSync(cacheFilePath, JSON.stringify(projectJson, null, 2), 'utf8');
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
				} catch (e) {}
				break;
			}
			await new Promise(resolve => setTimeout(resolve, retryDelayMs));
		}
	})();
}
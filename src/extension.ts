import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as os from "os";

let lruCache: string[] = [];
let ignoredFiles: string[] = [];
let extensionContext: vscode.ExtensionContext;
const currentlyPrompting = new Set<string>();

const CACHE_DIR_NAME = 'rust_solo_cache';
const PROJECT_FILE_NAME = 'rust-project.json';

export function activate(context: vscode.ExtensionContext) {
	extensionContext = context;

	const storedCache = context.workspaceState.get<string[]>('rustSoloCache', []);
	ignoredFiles = context.workspaceState.get<string[]>('rustSoloIgnored', []);

	lruCache = storedCache.filter(p => fs.existsSync(p));
	ignoredFiles = ignoredFiles.filter(p => fs.existsSync(p));

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			handleDocumentOpen(editor.document);
		}
	}));

	context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(handleDocumentClose));
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(handleConfigChange));

	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
		if (doc.fileName.endsWith('.rs') && doc.uri.scheme === 'file') {
			handleDocumentOpen(doc);
		}
	}));

	context.subscriptions.push(vscode.workspace.onDidDeleteFiles(async (e) => {
		let changed = false;
		for (const file of e.files) {
			if (lruCache.includes(file.fsPath)) {
				lruCache = lruCache.filter(p => p !== file.fsPath);
				changed = true;
			}
			if (ignoredFiles.includes(file.fsPath)) {
				ignoredFiles = ignoredFiles.filter(p => p !== file.fsPath);
				await context.workspaceState.update('rustSoloIgnored', ignoredFiles);
			}
		}
		if (changed) {
			await trimCache();
			await updateStateAndCache();
		}
	}));

	context.subscriptions.push(vscode.workspace.onDidRenameFiles(async (e) => {
		let changed = false;
		for (const file of e.files) {
			if (lruCache.includes(file.oldUri.fsPath)) {
				lruCache = lruCache.map(p => p === file.oldUri.fsPath ? file.newUri.fsPath : p);
				changed = true;
			}
			if (ignoredFiles.includes(file.oldUri.fsPath)) {
				ignoredFiles = ignoredFiles.map(p => p === file.oldUri.fsPath ? file.newUri.fsPath : p);
				await context.workspaceState.update('rustSoloIgnored', ignoredFiles);
			}
		}
		if (changed) {
			await trimCache();
			await updateStateAndCache();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('rustSolo.addFile', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.document.fileName.endsWith('.rs') && editor.document.uri.scheme === 'file') {
			const filePath = editor.document.uri.fsPath;
			if (!lruCache.includes(filePath)) {
				lruCache.push(filePath);
				if (ignoredFiles.includes(filePath)) {
					ignoredFiles = ignoredFiles.filter(p => p !== filePath);
					await context.workspaceState.update('rustSoloIgnored', ignoredFiles);
				}
				await trimCache();
				await updateStateAndCache();
				vscode.window.showInformationMessage(`Added ${path.basename(filePath)} to Rust Solo cache.`);
			} else {
				vscode.window.showInformationMessage(`${path.basename(filePath)} is already in the cache.`);
			}
		} else {
			vscode.window.showErrorMessage('No active standalone Rust file to add.');
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('rustSolo.removeFile', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.document.fileName.endsWith('.rs') && editor.document.uri.scheme === 'file') {
			const filePath = editor.document.uri.fsPath;
			if (lruCache.includes(filePath)) {
				lruCache = lruCache.filter(p => p !== filePath);
				if (!ignoredFiles.includes(filePath)) {
					ignoredFiles.push(filePath);
					await context.workspaceState.update('rustSoloIgnored', ignoredFiles);
				}
				await trimCache();
				await updateStateAndCache();
				vscode.window.showInformationMessage(`Removed ${path.basename(filePath)} from Rust Solo cache.`);
			} else {
				vscode.window.showInformationMessage(`${path.basename(filePath)} is not in the cache.`);
			}
		} else {
			vscode.window.showErrorMessage('No active standalone Rust file to remove.');
		}
	}));

	trimCache().then(() => updateStateAndCache());

	if (vscode.window.activeTextEditor) {
		handleDocumentOpen(vscode.window.activeTextEditor.document);
	}
}

async function handleDocumentOpen(doc: vscode.TextDocument) {
	if (!doc.fileName.endsWith('.rs') || doc.uri.scheme !== 'file') {
		return;
	}

	const wsFolders = vscode.workspace.workspaceFolders;
	if (!wsFolders || wsFolders.length === 0) {
		return;
	}

	const filePath = doc.uri.fsPath;

	if (lruCache.includes(filePath)) {
		if (lruCache[lruCache.length - 1] === filePath) {
			return;
		}

		lruCache = lruCache.filter(p => p !== filePath);
		lruCache.push(filePath);
		await trimCache();
		await updateStateAndCache();
		return;
	}

	if (ignoredFiles.includes(filePath) || currentlyPrompting.has(filePath)) {
		return;
	}

	currentlyPrompting.add(filePath);

	try {
		const fileName = path.basename(filePath);
		const answer = await vscode.window.showInformationMessage(
			`Add ${fileName} to Rust Solo LRU cache?`,
			'Yes', 'No'
		);

		if (answer === 'Yes') {
			lruCache.push(filePath);
			await trimCache();
			await updateStateAndCache();
		} else if (answer === 'No') {
			ignoredFiles.push(filePath);
			await extensionContext.workspaceState.update('rustSoloIgnored', ignoredFiles);
		}
	} finally {
		currentlyPrompting.delete(filePath);
	}
}

async function handleDocumentClose(doc: vscode.TextDocument) {
	if (doc.fileName.endsWith('.rs') && doc.uri.scheme === 'file') {
		await trimCache();
		await updateStateAndCache();
	}
}

async function handleConfigChange(e: vscode.ConfigurationChangeEvent) {
	if (e.affectsConfiguration('rustSolo.maxCacheSize')) {
		await trimCache();
		await updateStateAndCache();
	}
}

function getOpenRustFiles(): string[] {
	return vscode.workspace.textDocuments
		.filter(d => d.fileName.endsWith('.rs') && d.uri.scheme === 'file')
		.map(d => d.uri.fsPath);
}

let cachedSysrootSrc: string | undefined = undefined;
let hasAttemptedSysroot = false;

function getSysrootSrc(): string | undefined {
	if (hasAttemptedSysroot) {
		return cachedSysrootSrc;
	}
	hasAttemptedSysroot = true;

	let sysroot = '';

	try {
		sysroot = cp.execSync('rustc --print sysroot', { encoding: 'utf8' }).trim();
	} catch (e) {
		try {
			const cargoHome = process.env.CARGO_HOME || path.join(os.homedir(), '.cargo');

			const isWindows = os.platform() === 'win32';
			const executable = isWindows ? 'rustc.exe' : 'rustc';
			const rustcPath = path.join(cargoHome, 'bin', executable);

			sysroot = cp.execSync(`"${rustcPath}" --print sysroot`, { encoding: 'utf8' }).trim();
		} catch (fallbackError) {
			console.error("Rust Solo: Failed to find rust sysroot in PATH or default Cargo home.", fallbackError);
			return undefined;
		}
	}

	const sysrootSrc = path.join(sysroot, 'lib', 'rustlib', 'src', 'rust', 'library');
	if (fs.existsSync(sysrootSrc)) {
		cachedSysrootSrc = sysrootSrc;
		return sysrootSrc;
	}

	const legacySysrootSrc = path.join(sysroot, 'lib', 'rustlib', 'src', 'rust', 'src');
	if (fs.existsSync(legacySysrootSrc)) {
		cachedSysrootSrc = legacySysrootSrc;
		return legacySysrootSrc;
	}

	console.error(`Rust Solo: Found sysroot at ${sysroot}, but could not locate the 'src' directory inside it. Make sure you ran 'rustup component add rust-src'.`);
	return undefined;
}

async function trimCache() {
	const config = vscode.workspace.getConfiguration('rustSolo');
	const maxSize = config.get<number>('maxCacheSize', 8);
	const openFiles = getOpenRustFiles();

	while (lruCache.length > maxSize) {
		const indexToRemove = lruCache.findIndex(cachedPath => !openFiles.includes(cachedPath));
		if (indexToRemove !== -1) {
			lruCache.splice(indexToRemove, 1);
		} else {
			break;
		}
	}
}

async function updateStateAndCache() {
	await extensionContext.workspaceState.update('rustSoloCache', lruCache);

	const wsFolders = vscode.workspace.workspaceFolders;
	if (!wsFolders || wsFolders.length === 0) { return; }

	const workspacePath = wsFolders[0].uri.fsPath;
	const cacheDir = path.join(workspacePath, '.vscode', CACHE_DIR_NAME);
	const cacheFilePath = path.join(cacheDir, PROJECT_FILE_NAME);
	const relativeCacheFile = `./.vscode/${CACHE_DIR_NAME}/${PROJECT_FILE_NAME}`;

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
				deps: []
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
		const raExtension = vscode.extensions.getExtension('rust-lang.rust-analyzer');
		if (raExtension) {
			if (!raExtension.isActive) {
				await raExtension.activate();
			}
			try {
				await vscode.commands.executeCommand('rust-analyzer.reloadWorkspace');
			} catch (e) {
				// Fails silently if rust-analyzer is still booting up
			}
		}
	}
}

export function deactivate() { }
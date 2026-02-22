import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { syncRustProject } from './analyzer';

const DEFAULT_MAX_CACHE_SIZE = 8;

let lruCache: string[] = [];
let ignoredFiles: string[] = [];
let extensionContext: vscode.ExtensionContext;
const currentlyPrompting = new Set<string>();

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
			await updateStateAndSync();
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
			await updateStateAndSync();
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
				await updateStateAndSync();
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
				await updateStateAndSync();
				vscode.window.showInformationMessage(`Removed ${path.basename(filePath)} from Rust Solo cache.`);
			} else {
				vscode.window.showInformationMessage(`${path.basename(filePath)} is not in the cache.`);
			}
		} else {
			vscode.window.showErrorMessage('No active standalone Rust file to remove.');
		}
	}));

	updateStateAndSync();

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
		await updateStateAndSync();
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
			await updateStateAndSync();
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
		await updateStateAndSync();
	}
}

async function handleConfigChange(e: vscode.ConfigurationChangeEvent) {
	if (e.affectsConfiguration('rustSolo.maxCacheSize')) {
		await updateStateAndSync();
	}
}

function trimCache() {
	const config = vscode.workspace.getConfiguration('rustSolo');
	const maxSize = config.get<number>('maxCacheSize', DEFAULT_MAX_CACHE_SIZE);
	const openFiles = vscode.workspace.textDocuments
		.filter(d => d.fileName.endsWith('.rs') && d.uri.scheme === 'file')
		.map(d => d.uri.fsPath);

	while (lruCache.length > maxSize) {
		const indexToRemove = lruCache.findIndex(cachedPath => !openFiles.includes(cachedPath));
		if (indexToRemove !== -1) {
			lruCache.splice(indexToRemove, 1);
		} else {
			break;
		}
	}
}

async function updateStateAndSync() {
	trimCache();
	await extensionContext.workspaceState.update('rustSoloCache', lruCache);
	await syncRustProject(lruCache);
}

export function deactivate() { }
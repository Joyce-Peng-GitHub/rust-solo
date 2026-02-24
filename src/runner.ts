import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export class RustMainCodeLensProvider implements vscode.CodeLensProvider {
	private isFileCached: (filePath: string) => boolean;

	constructor(isFileCached: (filePath: string) => boolean) {
		this.isFileCached = isFileCached;
	}

	public async provideCodeLenses(
		document: vscode.TextDocument,
		token: vscode.CancellationToken
	): Promise<vscode.CodeLens[]> {
		if (!this.isFileCached(document.uri.fsPath)) {
			return [];
		}

		const lenses: vscode.CodeLens[] = [];
		let mainRange: vscode.Range | undefined;

		try {
			const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | vscode.SymbolInformation[]>(
				'vscode.executeDocumentSymbolProvider',
				document.uri
			);

			if (symbols && symbols.length > 0) {
				for (const symbol of symbols) {
					if (symbol.name === 'main' && symbol.kind === vscode.SymbolKind.Function) {
						mainRange = 'range' in symbol ? symbol.range : (symbol as vscode.SymbolInformation).location.range;
						break;
					}
				}
			}
		} catch (e) {
			// Language server not ready or failed
		}

		if (!mainRange) {
			const mainRegex = /^[ \t]*(?:(?:pub|async|unsafe|extern)\s+)*fn\s+main\s*\(/m;
			const text = document.getText();
			const match = mainRegex.exec(text);

			if (match) {
				const startPos = document.positionAt(match.index);
				const endPos = document.positionAt(match.index + match[0].length);
				mainRange = new vscode.Range(startPos, endPos);
			}
		}

		if (mainRange) {
			lenses.push(new vscode.CodeLens(mainRange, {
				title: "▶ Run (Solo)",
				command: "rustSolo.runFile",
				arguments: [document.uri]
			}));
			lenses.push(new vscode.CodeLens(mainRange, {
				title: "⚙ Debug (Solo)",
				command: "rustSolo.debugFile",
				arguments: [document.uri]
			}));
		}

		return lenses;
	}
}

function getBestDebugger(): 'lldb' | 'cppvsdbg' | 'cppdbg' | undefined {
	if (vscode.extensions.getExtension('vadimcn.vscode-lldb')) {
		return 'lldb';
	}
	if (vscode.extensions.getExtension('ms-vscode.cpptools')) {
		return process.platform === 'win32' ? 'cppvsdbg' : 'cppdbg';
	}
	return undefined;
}

export async function executeRustFile(documentUri: vscode.Uri, isDebug: boolean) {
	const document = await vscode.workspace.openTextDocument(documentUri);
	if (document.isDirty) {
		await document.save();
	}

	const sourcePath = documentUri.fsPath;
	const fileHash = crypto.createHash('md5').update(sourcePath).digest('hex').substring(0, 8);
	const parsedPath = path.parse(sourcePath);
	const exeExtension = process.platform === 'win32' ? '.exe' : '';
	
	const outputDir = path.join(os.tmpdir(), 'rust-solo-bin');
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}
	
	const executablePath = path.join(outputDir, `${parsedPath.name}_${fileHash}${exeExtension}`);
	const buildCommand = `rustc "${sourcePath}" -g -o "${executablePath}"`;

	// We use a task for compilation so the user sees build errors natively
	const compileTask = new vscode.Task(
		{ type: 'shell' },
		vscode.TaskScope.Workspace,
		'Compile Standalone Rust',
		'rust-solo',
		new vscode.ShellExecution(buildCommand)
	);

	const execution = await vscode.tasks.executeTask(compileTask);
	
	// Wait for compilation to finish
	const exitCode = await new Promise<number>((resolve) => {
		const disposable = vscode.tasks.onDidEndTaskProcess((e) => {
			if (e.execution === execution) {
				disposable.dispose();
				resolve(e.exitCode ?? 1);
			}
		});
	});

	if (exitCode !== 0) {
		// Do not run if compilation failed
		return;
	}

	if (!isDebug) {
		const term = vscode.window.createTerminal(`Rust Solo: ${parsedPath.name}`);
		term.show();

		// Check if the current shell is PowerShell to apply the correct syntax
		const shell = vscode.env.shell.toLowerCase();
		if (shell.includes('powershell') || shell.includes('pwsh')) {
			term.sendText(`& "${executablePath}"`);
		} else {
			term.sendText(`"${executablePath}"`);
		}
	} else {
		const debuggerType = getBestDebugger();
		if (!debuggerType) {
			const choice = await vscode.window.showErrorMessage(
				"No compatible debugger found. Please install 'CodeLLDB' (recommended) or the C/C++ extension.",
				"Install CodeLLDB"
			);
			if (choice === "Install CodeLLDB") {
				vscode.commands.executeCommand('extension.open', 'vadimcn.vscode-lldb');
			}
			return;
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
		const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(documentUri.fsPath);
		
		let debugConfig: vscode.DebugConfiguration;

		switch (debuggerType) {
			case 'lldb':
				debugConfig = {
					type: 'lldb',
					request: 'launch',
					name: 'Debug Rust Solo (CodeLLDB)',
					program: executablePath,
					args: [],
					cwd: cwd,
					terminal: 'integrated' 
				};
				break;
			case 'cppvsdbg':
				debugConfig = {
					type: 'cppvsdbg',
					request: 'launch',
					name: 'Debug Rust Solo (MSVC)',
					program: executablePath,
					args: [],
					cwd: cwd,
					environment: [],
					console: 'integratedTerminal'
				};
				break;
			case 'cppdbg':
				debugConfig = {
					type: 'cppdbg',
					request: 'launch',
					name: 'Debug Rust Solo (GDB/LLDB)',
					program: executablePath,
					args: [],
					cwd: cwd,
					environment: [],
					externalConsole: false,
					MIMode: process.platform === 'darwin' ? 'lldb' : 'gdb',
					setupCommands: [
						{
							description: "Enable pretty-printing for gdb",
							text: "-enable-pretty-printing",
							ignoreFailures: true
						}
					]
				};
				break;
		}

		await vscode.debug.startDebugging(workspaceFolder, debugConfig);
	}
}
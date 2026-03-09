# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-09
**Stack:** TypeScript, VS Code Extension API

## OVERVIEW

VS Code extension for standalone Rust file development. Generates dynamic `Cargo.toml` workspace for rust-analyzer, enabling IntelliSense/run/debug with full diagnostics support without Cargo workspace overhead. Integrates with rust-analyzer, CodeLLDB, and C/C++ debuggers.

## STRUCTURE

```
rust-solo/
├── src/
│   ├── extension.ts   # Entry point, LRU cache, commands
│   └── analyzer.ts    # Cargo.toml generation, rust-analyzer sync
├── .vscode/           # Workspace settings, launch/tasks config
├── doc/prompts/       # Original design specs
└── package.json       # Extension manifest, contributes commands/config
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add/modify commands | `extension.ts` | Register in `activate()`, update `package.json` contributes |
| Change LRU cache logic | `extension.ts` | `lruCache` array, `trimCache()`, `updateStateAndSync()` |
| Modify Cargo.toml format | `analyzer.ts` | `generateCargoToml()` creates the TOML structure |
| Extension settings | `package.json` | `contributes.configuration.properties` |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `activate` | Function | extension.ts:13 | Extension entry point |
| `lruCache` | Variable | extension.ts:8 | LRU file path cache |
| `syncRustProject` | Function | analyzer.ts:10 | Generate Cargo.toml workspace |
| `generateCargoToml` | Function | analyzer.ts:97 | Create TOML manifest |

## CONVENTIONS

- **Strict TypeScript**: `strict: true` in tsconfig.json
- **ESM modules**: `Node16` module, `ES2022` target
- **No tests**: `.vscode-test.mjs` configured but no test files exist
- **Bundle with esbuild**: `npm run package` bundles to single `out/extension.js`

## ANTI-PATTERNS

- **Empty catch blocks**: See `analyzer.ts:89` - silently ignores rust-analyzer reload errors
- **Global mutable state**: `lruCache`, `ignoredFiles`, `extensionContext` are module-level vars
- **Sync filesystem ops**: Uses `fs.existsSync`, `fs.mkdirSync`, `fs.writeFileSync` throughout

## UNIQUE STYLES

- **LRU cache stored in workspaceState**: Persisted across sessions via `context.workspaceState`
- **Cargo.toml workspace**: Generates a single workspace with multiple `[[bin]]` targets for standalone files

## COMMANDS

```powershell
# Development
npm run compile          # TypeScript compile
npm run watch            # Watch mode
npm run package          # Bundle with esbuild

# Build VSIX
npm install -g @vscode/vsce
vsce package             # Creates rust-solo-<version>.vsix
```

## NOTES

- Requires `rustup component add rust-src` for stdlib definitions
- Depends on `rust-analyzer` extension for IntelliSense
- Cache stored at `.vscode/rust_solo_cache/Cargo.toml`
- Breakpoints auto-cleaned when standalone `.rs` files are deleted
- Run/Debug provided natively by rust-analyzer via Cargo.toml

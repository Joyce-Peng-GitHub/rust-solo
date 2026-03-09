# Rust Solo

A Visual Studio Code extension that enables full rust-analyzer support for standalone Rust files (`.rs`) without requiring a Cargo workspace.

## Features

**Just open a `.rs` file and get:**
- Full IntelliSense (auto-completion, go to definition, type hints)
- Complete compiler diagnostics via `cargo check`
- Native Run and Debug support through rust-analyzer
- Standard library definitions

**How it works:** Rust Solo generates a dynamic `Cargo.toml` in `.vscode/rust_solo_cache/` containing all your standalone files as `[[bin]]` targets. This tricks rust-analyzer into treating them as a regular Cargo project.

### Key Features

- **Zero Configuration:** Open a `.rs` file, accept the prompt, and everything works
- **LRU Cache:** Maintains a configurable-size cache of your standalone files
- **Smart Prompts:** Remembers your "No" answers per file
- **Automatic Cleanup:** Handles file renames, deletions, and orphaned breakpoints
- **Native Integration:** Uses rust-analyzer's built-in Run/Debug CodeLens

## Requirements

1. **[rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)** extension
2. **Rust toolchain** installed via `rustup`
3. **Rust standard library source** (required for stdlib definitions):
   ```bash
   rustup component add rust-src
   ```

## Commands

| Command | Description |
|---------|-------------|
| `Rust Solo: Add current file to cache` | Manually add the current file |
| `Rust Solo: Remove current file from cache` | Remove and ignore the current file |
| `Rust Solo: Clear entire LRU cache` | Clear all cached files |

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `rustSolo.maxCacheSize` | 32 | Maximum standalone files in cache |
| `rustSolo.reloadMaxRetries` | 16 | Polling retries for rust-analyzer startup |
| `rustSolo.reloadRetryDelayMs` | 500 | Delay between polls (ms) |

## Installation

### From VSIX

1. Download `rust-solo-<version>.vsix` from [Releases](https://github.com/Joyce-Peng-GitHub/rust-solo/releases)
2. In VS Code: `Ctrl+Shift+P` → "Extensions: Install from VSIX..."

```bash
# Or via command line
code --install-extension rust-solo-<version>.vsix
```

### From Source

```bash
git clone https://github.com/Joyce-Peng-GitHub/rust-solo.git
cd rust-solo
npm install
npm run compile
npm install -g @vscode/vsce
vsce package
```

## How It Works

1. When you open a standalone `.rs` file, Rust Solo prompts to add it to the cache
2. It generates `.vscode/rust_solo_cache/Cargo.toml` with all cached files as `[[bin]]` targets
3. The path is added to `rust-analyzer.linkedProjects`
4. rust-analyzer loads it as a Cargo project, enabling:
   - Full diagnostics via `cargo check`
   - Native Run/Debug CodeLens buttons
   - Complete IntelliSense

```
.vscode/rust_solo_cache/
├── Cargo.toml      # Generated workspace
├── Cargo.lock      # Auto-generated
└── target/         # Build artifacts
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

[AGPL-3.0](./LICENSE)

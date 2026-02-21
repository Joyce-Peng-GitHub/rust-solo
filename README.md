# Rust Solo

An elegant Visual Studio Code extension to help you code standalone Rust files (`.rs`) without the friction of constantly creating full Cargo workspaces. Designed to work seamlessly alongside [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).

## Features

If you ever wanted to just drop a single `.rs` file into a directory, open it in VS Code, and immediately get auto-completion, linting, and standard library definitions—this extension is for you.

By default, `rust-analyzer` complains about standalone `.rs` files that don't belong to a `Cargo.toml` project. **Rust Solo** acts as a dynamic manager that automatically generates a lightweight `rust-project.json` in your `.vscode` folder on the fly.

- **Zero Configuration:** Simply open or create a `.rs` file.
- **Dynamic LRU Cache:** Maintains a Least-Recently Used (LRU) cache of your standalone Rust files.
- **Smart Prompts:** Automatically asks if you'd like to add newly opened standalone `.rs` files to the workspace. If you say "No", it remembers your choice for that file.
- **Manual Control:** Use the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) to run `Rust Solo: Add current file to cache` or `Rust Solo: Remove current file from cache` if you change your mind.
- **IntelliSense Ready:** Automatically locates your Rust `sysroot` (from `rustc`) to ensure the standard library definitions work right out of the box.

## Requirements

1. **rust-analyzer**: You must have the official `rust-analyzer` extension installed for IntelliSense.
2. **Rust Toolchain**: You must have Rust installed (via `rustup` or `cargo`).
3. **(VERY IMPORTANT!) Rust Standard Library Source**: Ensure you've downloaded the rust source so that `rust-analyzer` can jump to standard library definitions.
   Run: `rustup component add rust-src`

## Extension Settings

You can customize the extension via `settings.json`:

* `rustSolo.maxCacheSize`: The maximum number of standalone files kept in the cache. *(Default: 8)*. If you open more standalone files than this size, the least recently used ones will be dropped to maintain performance.

## Release Notes

### 1.1.0
- Added manual cache control commands (`Rust Solo: Add current file to cache` / `Rust Solo: Remove current file from cache`).

### 1.0.0
- Initial stable release of Rust Solo.
- Dynamic `rust-project.json` generation logic.
- Intelligent prompt system with persistent ignore lists to avoid prompt spam.
- Integrated `sysroot` resolution fallback mechanism for Windows/Linux/macOS.

---

**Source Code:** [GitHub Repository](https://github.com/Joyce-Peng-GitHub/rust-solo)  
**License:** GPL-3.0

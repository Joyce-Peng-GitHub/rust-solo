# Changelog

All notable changes to the "Rust Solo" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-22

### Added
- **Manual Cache Management:** Added two new commands to the VS Code Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):
  - `Rust Solo: Add current file to cache`: Manually forces the current standalone Rust file into the cache (especially useful if you previously clicked "No" and ignored it).
  - `Rust Solo: Remove current file from cache`: Immediately drops the file from the cache and adds it to the ignore list, preventing future prompts.

## [1.0.0] - 2026-02-22

### Added
- **Initial Release:** Core functionality to support standalone Rust (`.rs`) files using `rust-analyzer` without a full `Cargo.toml` project.
- **Dynamic Project Generation:** Automatically constructs a `rust-project.json` file inside the `.vscode` directory upon opening standalone `.rs` files.
- **Intelligent Prompt System:** Prompts the user to add new standalone files to the workspace. Allows users to click "No" and ignore the file in subsequent sessions to avoid notification spam.
- **LRU Cache System:** Configurable Least-Recently Used (LRU) cache (default 8) that tracks active standalone Rust files, automatically dropping older files when the limit is hit to maintain performance.
- **Sysroot Resolution:** Automatically locates the Rust installation sysroot across different operating systems to inject `sysroot_src` into the workspace, immediately enabling IntelliSense for the Rust Standard Library.

- **Performance Optimizations:** Synchronous operations (like executing `rustc --print sysroot`) are cached locally so they do not hang the VS Code extension host.
- **Concurrent Prompt Logic:** Optimized concurrent file loading logic prevents multiple prompt dialogs from stacking for the same file.
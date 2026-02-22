# Changelog

All notable changes to the "Rust Solo" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-22

### Added
- **Clear Cache Command:** Introduced a new command `Rust Solo: Clear entire LRU cache` (`rustSolo.clearCache`) to easily reset and wipe all cached files in one click.

## [1.1.2] - 2026-02-22

### Fixed
- **Mismatched default value:** Updated an omitted default value of `reloadMaxRetries`. The `analyzer.ts` has the default value set as `16` but the value in configuration is set to `20`, caused by carelessly omitting the line `"default": 16,` in `package.json`.

## [1.1.1] - 2026-02-22

### Fixed
- **Static Checker Failure (Critical):** Resolved a critical issue where the rust-analyzer static checker failed to analyze code until a standalone file was manually added to `linkedProjects`. This was caused by `rust-project.json` missing the `is_workspace_member: true` flag, which completely disabled implicit standard library (`std`, `core`, `alloc`) inclusion for cached files. 
- **Startup Reload Race Condition:** Implemented an asynchronous retry loop for `rust-analyzer.reloadWorkspace` to guarantee the language server loads the generated `rust-project.json` reliably on VS Code startup. Users can configure this polling behavior through the newly added `rustSolo.reloadMaxRetries` and `rustSolo.reloadRetryDelayMs` settings.
- **Codebase Refactor:** Split the monolithic `extension.ts` into multiple modules (`extension.ts`, `analyzer.ts`, `sysroot.ts`) and removed excessive comments, making the extension highly maintainable and clean.

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
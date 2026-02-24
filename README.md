# Rust Solo

An elegant Visual Studio Code extension to help you code standalone Rust files (`.rs`) without the friction of constantly creating full Cargo workspaces. Designed to work seamlessly alongside [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).

## Features

If you ever wanted to just drop standalone `.rs` files into a directory, open them in VS Code, and immediately get auto-completion, linting, and standard library definitions --- this extension is for you.

By default, `rust-analyzer` complains about standalone `.rs` files that don't belong to a `Cargo.toml` project. **Rust Solo** acts as a dynamic manager that automatically generates a lightweight `rust-project.json` in your `.vscode` folder on the fly.

- **Zero Configuration:** Simply open or create a `.rs` file.
- **Dynamic LRU Cache:** Maintains a Least-Recently Used (LRU) cache of your standalone Rust files.
- **Smart Prompts:** Automatically asks if you'd like to add newly opened standalone `.rs` files to the workspace. If you say "No", it remembers your choice for that file.
- **Manual Control:** If you change your mind, use the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) to run `Rust Solo: Add current file to cache`, `Rust Solo: Remove current file from cache`, or `Rust Solo: Clear entire LRU cache`. You can also manually trigger `Rust Solo: Run Standalone File` and `Rust Solo: Debug Standalone File`.
- **IntelliSense Ready:** Automatically locates your Rust `sysroot` (from `rustc`) to ensure the standard library definitions work right out of the box.
- **File Management:** Automatically handles file renames and deletions, keeping your cache and breakpoints clean and up-to-date.

## Requirements

1. **rust-analyzer**: You must have the official `rust-analyzer` extension installed for IntelliSense.
2. **Rust Toolchain**: You must have Rust installed (via `rustup` or `cargo`).
3. **(VERY IMPORTANT!) Rust Standard Library Source**: Ensure you've downloaded the rust source so that `rust-analyzer` can jump to standard library definitions.
   Run: `rustup component add rust-src`

## Extension Settings

You can customize the extension via `settings.json`:

* `rustSolo.maxCacheSize`: The maximum number of standalone files kept in the cache. *(Default: 8)*. If you open more standalone files than this size, the least recently used ones will be dropped to maintain performance.
* `rustSolo.reloadMaxRetries`: The maximum number of times to poll for rust-analyzer to become active on startup. *(Default: 16)*.
* `rustSolo.reloadRetryDelayMs`: The delay in milliseconds between polls when waiting for rust-analyzer. *(Default: 500)*.

## Installation

Since this project is a [Visual Studio Code](https://code.visualstudio.com/) extension, I presume that you have VS Code installed already.

You can either download pre-packaged `.vsix` files from the [GitHub Releases page](https://github.com/Joyce-Peng-GitHub/rust-solo/releases) or package it yourself following the instructions in the `Development` section.

#### Option 1: Install via VS Code UI

1.  Open VS Code.
2.  Go to the `Extensions` view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3.  Click the `...` button (three dots menu) in the Extensions panel header.
4.  Select `Install from VSIX...`.
5.  Navigate to and select the `rust-solo-<version>.vsix` file you downloaded or generated.

#### Option 2: Install via Command Line

```bash
# For VS Code
code --install-extension rust-solo-<version>.vsix

# For VS Code Insiders
code-insiders --install-extension rust-solo-<version>.vsix
```

## Development

### Prerequisites

Before you begin, ensure you have the following installed:

- **[Node.js](https://nodejs.org/)** (v18 or later)
- **[Git](https://git-scm.com/)**
- And, of course, **[Visual Studio Code](https://code.visualstudio.com/)**

### Clone and Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/Joyce-Peng-GitHub/rust-solo.git
    cd rust-solo
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Package the Extension

To create a `.vsix` installation file:

1.  Install the VS Code Extension Manager (`vsce`) globally:
    ```bash
    npm install -g @vscode/vsce
    ```

2.  Package the extension:
    ```bash
    vsce package
    ```

This will generate a file named `rust-solo-<version>.vsix` in the project root directory.

## Release Notes

### 1.3.0
- Added a full standalone execution layer. New `▶ Run (Solo) | ⚙ Debug (Solo)` CodeLens buttons appear above `fn main()` in `.rs` files, and new commands are available in the Command Palette.
- Automatically compiles standalone files directly via `rustc -g` into the OS temporary directory without touching your source workspace.
- Utilizes VS Code Tasks for compilation to display build errors natively.
- Full breakpoint and variable inspection support dynamically integrating with `vadimcn.vscode-lldb` (CodeLLDB) or Microsoft C/C++ Extensions.
- Automatically handles file renames to keep the cache and ignored files list in sync.
- Evaluates standalone Rust files when they are saved, prompting to add them to the cache if they aren't already tracked or ignored.
- Fixed an issue where the `▶ Run (Solo)` command would fail to execute in PowerShell terminals.
- Automatically cleans up orphaned breakpoints in the VS Code debug panel when a standalone `.rs` file is deleted.

### 1.2.0
- Added a new command `Rust Solo: Clear entire LRU cache` to instantly wipe the current cache and reset the workspace logic.

### 1.1.2
- Corrected an unexpected default value `20` of `rustSolo.reloadMaxRetries` (which is expected to be `16` by default) in the extension configuration.

### 1.1.1
- Resolved a critical bug preventing the static checker from parsing standard library traits out of the box.
- Stabilized startup race conditions with `rust-analyzer` via asynchronous command polling.
- Completely refactored the extension internals for better maintainability.

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

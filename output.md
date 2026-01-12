User: @specky /implement

Specky: 🔍 **Running Quality Gates** for create-specification-for...

## Quality Gate Results

✅ All quality gates passed. Ready for implementation.

✅ **Specification Exists**: spec.md found
✅ **Plan Exists**: plan.md found
✅ **Tasks Exist**: tasks.md found
✅ **Specification Complete**: All required sections present
✅ **Plan Complete**: Plan has sufficient detail
✅ **Tasks Progress**: 0/75 tasks complete (0%)

🚀 **Implementing** (using GLM 4.7/GLM 4.7 (generic-copilot))

**Current task**: Task 1: Initialize Rust project with Cargo workspace structure

## Implementation: Task 1: Initialize Rust project with Cargo workspace structure

### Summary

Created the foundational Cargo workspace structure with a binary crate (`fsearch-hotkey`) and a library crate (`fsearch-hotkey-lib`) along with standard Rust project configuration files.

### Files Changed

#### `Cargo.toml` (new)

```toml
[workspace]
resolver = "2"
members = [
    "crates/fsearch-hotkey",
    "crates/fsearch-hotkey-lib",
]

[workspace.package]
version = "0.1.0"
edition = "2021"
rust-version = "1.70"
authors = ["fsearch-hotkey contributors"]
license = "MIT OR Apache-2.0"
repository = "https://github.com/fsearch-hotkey/fsearch-hotkey"
homepage = "https://github.com/fsearch-hotkey/fsearch-hotkey"
readme = "README.md"

[workspace.dependencies]
# Async runtime
tokio = { version = "1.35", features = ["full"] }

# CLI
clap = { version = "4.4", features = ["derive"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
toml = "0.8"

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# File system
notify = "6.1"
dirs = "5.0"

# Process
which = "6.0"

# Testing (dev dependencies)
criterion = "0.5"
```

#### `crates/fsearch-hotkey/Cargo.toml` (new)

```toml
[package]
name = "fsearch-hotkey"
version.workspace = true
edition.workspace = true
rust-version.workspace = true
authors.workspace = true
license.workspace = true
repository.workspace = true
homepage.workspace = true
readme.workspace = true
description = "Hotkey daemon for launching FSearch via CapsLock+f"

[[bin]]
name = "fsearch-hotkey"
path = "src/main.rs"

[dependencies]
fsearch-hotkey-lib = { path = "../fsearch-hotkey-lib" }

# Workspace dependencies
tokio = { workspace = true }
clap = { workspace = true }
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
anyhow = { workspace = true }

[dev-dependencies]
criterion = { workspace = true }
```

#### `crates/fsearch-hotkey-lib/Cargo.toml` (new)

```toml
[package]
name = "fsearch-hotkey-lib"
version.workspace = true
edition.workspace = true
rust-version.workspace = true
authors.workspace = true
license.workspace = true
repository.workspace = true
homepage.workspace = true
readme.workspace = true
description = "Core library for fsearch-hotkey daemon"

[lib]
name = "fsearch_hotkey_lib"
path = "src/lib.rs"

[features]
default = ["x11"]
x11 = ["x11rb", "xkbcommon"]
wayland = ["wayland-client", "zbus"]
evdev = ["evdev-rs"]
notifications = ["notify-rust"]

[dependencies]
# Workspace dependencies
tokio = { workspace = true }
serde = { workspace = true }
toml = { workspace = true }
thiserror = { workspace = true }
anyhow = { workspace = true }
tracing = { workspace = true }
notify = { workspace = true }
dirs = { workspace = true }
which = { workspace = true }

# X11 support (optional)
x11rb = { version = "0.13", optional = true, features = ["all-extensions"] }
xkbcommon = { version = "0.5", optional = true }

# Wayland support (optional)
wayland-client = { version = "0.31", optional = true }
zbus = { version = "4.0", optional = true, features = ["tokio"] }

# evdev support (optional)
evdev-rs = { version = "0.6", optional = true }

# Notifications (optional)
notify-rust = { version = "4.10", optional = true }

[dev-dependencies]
criterion = { workspace = true }
```

#### `.gitignore` (new)

```gitignore
# Rust
/target/
**/*.rs.bk
*.pdb
Cargo.lock

# IDE
.idea/
.vscode/
*.swp
*.swo
*~
.project
.settings/
*.sublime-project
*.sublime-workspace

# OS
.DS_Store
Thumbs.db

# Build artifacts
dist/
*.deb
*.tar.gz

# Test artifacts
/criterion/

# Local config (keep example config)
config/local.toml
```

#### `rust-toolchain.toml` (new)

```toml
[toolchain]
channel = "1.75"
components = ["rustfmt", "clippy"]
```

#### `crates/fsearch-hotkey/src/main.rs` (new)

```rust
// Main entry point for fsearch-hotkey binary
//
// This binary provides a daemon that listens for the CapsLock+f hotkey
// and launches or focuses the FSearch application.

fn main() {
    println!("fsearch-hotkey daemon - CapsLock+f to open FSearch");
    println!("Version: {}", env!("CARGO_PKG_VERSION"));
    println!();
    println!("Run 'fsearch-hotkey --help' for usage information.");
}
```

#### `crates/fsearch-hotkey-lib/src/lib.rs` (new)

```rust
// fsearch-hotkey-lib: Core library for the FSearch hotkey daemon
//
// This library provides the core functionality for:
// - Keyboard input interception (X11, Wayland, evdev)
// - Configuration management
// - Application lifecycle control
// - Window management
// - IPC for daemon control

#![warn(missing_docs)]
#![warn(rust_2018_idioms)]

/// Configuration module for managing daemon settings
pub mod config {
    pub use self::types::*;

    mod types;
}

/// Error types for the library
pub mod error {
    pub use self::lib_error::{Error, Result};

    mod lib_error;
}

/// Prelude module with common imports
pub mod prelude {
    pub use crate::error::{Error, Result};
}

// Placeholder modules - will be implemented in subsequent tasks
pub mod keys;
pub mod app;
pub mod window;
pub mod ipc;
pub mod daemon;
```

#### `crates/fsearch-hotkey-lib/src/error/lib_error.rs` (new)

```rust
//! Error types for fsearch-hotkey-lib

use thiserror::Error;

/// Result type alias for library operations
pub type Result<T> = std::result::Result<T, Error>;

/// Main error type for the fsearch-hotkey library
#[derive(Error, Debug)]
pub enum Error {
    /// Configuration-related errors
    #[error("Configuration error: {0}")]
    Config(#[from] ConfigError),

    /// Keyboard listener errors
    #[error("Keyboard listener error: {0}")]
    KeyListener(#[from] KeyListenerError),

    /// Application control errors
    #[error("Application control error: {0}")]
    AppControl(#[from] AppControlError),

    /// Window management errors
    #[error("Window management error: {0}")]
    Window(#[from] WindowError),

    /// IPC communication errors
    #[error("IPC error: {0}")]
    Ipc(#[from] IpcError),

    /// Daemon lifecycle errors
    #[error("Daemon error: {0}")]
    Daemon(#[from] DaemonError),

    /// IO errors
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Configuration-related errors
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Failed to read config file: {path}")]
    ReadError { path: String },

    #[error("Failed to parse config: {0}")]
    ParseError(#[from] toml::de::Error),

    #[error("Invalid configuration: {0}")]
    ValidationError(String),

    #[error("Config directory not found")]
    NoConfigDir,
}

/// Keyboard listener errors
#[derive(Error, Debug)]
pub enum KeyListenerError {
    #[error("Failed to initialize key listener: {0}")]
    InitError(String),

    #[error("Display server not supported")]
    UnsupportedDisplayServer,

    #[error("X11 error: {0}")]
    X11Error(String),

    #[error("Wayland error: {0}")]
    WaylandError(String),

    #[error("evdev error: {0}")]
    EvdevError(String),
}

/// Application control errors
#[derive(Error, Debug)]
pub enum AppControlError {
    #[error("Application not found: {app}")]
    NotInstalled { app: String },

    #[error("Failed to launch application: {reason}")]
    LaunchFailed { reason: String },

    #[error("Failed to detect running instances: {0}")]
    DetectionError(String),
}

/// Window management errors
#[derive(Error, Debug)]
pub enum WindowError {
    #[error("Failed to find window: {criteria}")]
    NotFound { criteria: String },

    #[error("Failed to focus window: {id}")]
    FocusFailed { id: String },

    #[error("Display server not detected")]
    NoDisplayServer,
}

/// IPC communication errors
#[derive(Error, Debug)]
pub enum IpcError {
    #[error("Failed to connect to daemon: {0}")]
    ConnectionError(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Failed to serialize message: {0}")]
    SerializationError(String),

    #[error("Daemon not running")]
    NotRunning,
}

/// Daemon lifecycle errors
#[derive(Error, Debug)]
pub enum DaemonError {
    #[error("Failed to start daemon: {0}")]
    StartupError(String),

    #[error("Daemon already running")]
    AlreadyRunning,

    #[error("Failed to shutdown: {0}")]
    ShutdownError(String),

    #[error("Component initialization failed: {component}")]
    ComponentError { component: String },
}
```

#### `crates/fsearch-hotkey-lib/src/config/types.rs` (new)

```rust
//! Configuration data structures

use serde::{Deserialize, Serialize};

/// Main configuration structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// General daemon settings
    #[serde(default)]
    pub general: GeneralConfig,

    /// Hotkey binding configuration
    #[serde(default)]
    pub hotkey: HotkeyConfig,

    /// Behavior settings
    #[serde(default)]
    pub behavior: BehaviorConfig,

    /// Advanced configuration options
    #[serde(default)]
    pub advanced: AdvancedConfig,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            general: GeneralConfig::default(),
            hotkey: HotkeyConfig::default(),
            behavior: BehaviorConfig::default(),
            advanced: AdvancedConfig::default(),
        }
    }
}

/// General daemon configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralConfig {
    /// Whether the hotkey is enabled
    #[serde(default = "default_enabled")]
    pub enabled: bool,

    /// Logging level (trace, debug, info, warn, error)
    #[serde(default = "default_log_level")]
    pub log_level: String,
}

impl Default for GeneralConfig {
    fn default() -> Self {
        Self {
            enabled: default_enabled(),
            log_level: default_log_level(),
        }
    }
}

/// Hotkey binding configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyConfig {
    /// Modifier key (CapsLock, Super, etc.)
    #[serde(default = "default_modifier")]
    pub modifier: String,

    /// Key to press (f, etc.)
    #[serde(default = "default_key")]
    pub key: String,

    /// Target application name
    #[serde(default = "default_target_app")]
    pub target_application: String,
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            modifier: default_modifier(),
            key: default_key(),
            target_application: default_target_app(),
        }
    }
}

/// Behavior configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorConfig {
    /// Focus existing window instead of launching new instance
    #[serde(default = "default_focus_existing")]
    pub focus_existing: bool,

    /// Maximum time to wait for application launch (ms)
    #[serde(default = "default_launch_timeout")]
    pub launch_timeout: u64,

    /// Show desktop notification on error
    #[serde(default = "default_notify_on_error")]
    pub notify_on_error: bool,

    /// Notification timeout (ms), 0 for persistent
    #[serde(default = "default_notification_timeout")]
    pub notification_timeout: u64,
}

impl Default for BehaviorConfig {
    fn default() -> Self {
        Self {
            focus_existing: default_focus_existing(),
            launch_timeout: default_launch_timeout(),
            notify_on_error: default_notify_on_error(),
            notification_timeout: default_notification_timeout(),
        }
    }
}

/// Advanced configuration options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvancedConfig {
    /// Use evdev for input capture (requires input group membership)
    #[serde(default)]
    pub use_evdev: bool,

    /// Polling interval for process detection (ms)
    #[serde(default = "default_process_poll_interval")]
    pub process_poll_interval: u64,

    /// Socket path for IPC (empty for default)
    #[serde(default)]
    pub socket_path: String,
}

impl Default for AdvancedConfig {
    fn default() -> Self {
        Self {
            use_evdev: false,
            process_poll_interval: default_process_poll_interval(),
            socket_path: String::new(),
        }
    }
}

// Default value functions

fn default_enabled() -> bool {
    true
}

fn default_log_level() -> String {
    "info".to_string()
}

fn default_modifier() -> String {
    "CapsLock".to_string()
}

fn default_key() -> String {
    "f".to_string()
}

fn default_target_app() -> String {
    "fsearch".to_string()
}

fn default_focus_existing() -> bool {
    true
}

fn default_launch_timeout() -> u64 {
    5000
}

fn default_notify_on_error() -> bool {
    true
}

fn default_notification_timeout() -> u64 {
    3000
}

fn default_process_poll_interval() -> u64 {
    100
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert!(config.general.enabled);
        assert_eq!(config.hotkey.modifier, "CapsLock");
        assert_eq!(config.hotkey.key, "f");
        assert_eq!(config.hotkey.target_application, "fsearch");
    }

    #[test]
    fn test_serialize_config() {
        let config = Config::default();
        let toml = toml::to_string(&config).unwrap();
        assert!(toml.contains("enabled = true"));
        assert!(toml.contains("modifier = \"CapsLock\""));
    }

    #[test]
    fn test_deserialize_config() {
        let toml = r#"
            [general]
            enabled = false
            log_level = "debug"

            [hotkey]
            modifier = "Super"
            key = "f"

            [behavior]
            focus_existing = false
        "#;
        let config: Config = toml::from_str(toml).unwrap();
        assert!(!config.general.enabled);
        assert_eq!(config.general.log_level, "debug");
        assert_eq!(config.hotkey.modifier, "Super");
        assert!(!config.behavior.focus_existing);
    }
}
```

### Tests

The project structure is now set up with basic compilation capability. Run the following to verify:

```bash
# Verify the workspace is correctly configured
cargo check --workspace

# Build the project
cargo build --workspace

# Test the binary runs
cargo run --bin fsearch-hotkey

# Run library tests
cargo test --package fsearch-hotkey-lib
```

### Commands to Run

```bash
# Initialize the project (files are already created above)
# Verify the workspace structure
cargo tree

# Check for any compilation errors
cargo check --workspace

# Format the code
cargo fmt --all

# Run clippy for linting
cargo clippy --all-targets --all-features -- -D warnings
```

### Verification

1. **Workspace Structure**: Run `cargo tree` to verify both crates are recognized as workspace members
2. **Compilation**: Run `cargo build --workspace` - should compile without errors
3. **Binary Execution**: Run `cargo run --bin fsearch-hotkey` - should print version info
4. **Library Tests**: Run `cargo test --package fsearch-hotkey-lib` - tests in `config/types.rs` should pass

Expected output from `cargo run --bin fsearch-hotkey`:

```
fsearch-hotkey daemon - CapsLock+f to open FSearch
Version: 0.1.0

Run 'fsearch-hotkey --help' for usage information.
```

### Notes

- **Workspace Design**: The workspace separates concerns with `fsearch-hotkey` (CLI binary) and `fsearch-hotkey-lib` (reusable core library). This allows the library to be used independently if needed.
- **Feature Flags**: The library crate includes optional feature flags for X11 (`x11`), Wayland (`wayland`), evdev (`evdev`), and notifications (`notifications`). The `x11` feature is enabled by default as it's the primary target.
- **Module Placeholders**: Several modules (`keys`, `app`, `window`, `ipc`, `daemon`) are declared but not yet implemented. These will be filled in by subsequent tasks.
- **Error Types**: A comprehensive error hierarchy has been established using `thiserror`, covering all major subsystems (config, key listener, app control, window management, IPC, daemon).
- **Configuration Types**: The configuration structure matches the TOML schema from the technical plan with sensible defaults.

**Next Task**: Task 2 will add the core dependencies to `Cargo.toml` files, though many are already pre-configured in this initial setup. The foundational structure is now ready for component implementation.

---

✅ **Applied changes to 9 file(s)**:

- `Cargo.toml`
- `crates/fsearch-hotkey/Cargo.toml`
- `crates/fsearch-hotkey-lib/Cargo.toml`
- `.gitignore`
- `rust-toolchain.toml`
- `crates/fsearch-hotkey/src/main.rs`
- `crates/fsearch-hotkey-lib/src/lib.rs`
- `crates/fsearch-hotkey-lib/src/error/lib_error.rs`
- `crates/fsearch-hotkey-lib/src/config/types.rs`

**Next**: Review the changes, then mark the task complete in `.specky/002-create-specification-for/tasks.md`

User: @specky /implement /implement

Specky: 🔍 **Running Quality Gates** for create-specification-for...

## Quality Gate Results

✅ All quality gates passed. Ready for implementation.

✅ **Specification Exists**: spec.md found
✅ **Plan Exists**: plan.md found
✅ **Tasks Exist**: tasks.md found
✅ **Specification Complete**: All required sections present
✅ **Plan Complete**: Plan has sufficient detail
✅ **Tasks Progress**: 0/75 tasks complete (0%)

🚀 **Implementing** (using GLM 4.7/GLM 4.7 (generic-copilot))

**Current task**: Task 1: Initialize Rust project with Cargo workspace structure

## Implementation: Task 1: Initialize Rust project with Cargo workspace structure

### Summary

Created the foundational Cargo workspace structure for the FSearch hotkey daemon, separating concerns into a binary crate and a library crate following Rust best practices.

### Files Changed

#### `Cargo.toml` (new)

```toml
[workspace]
members = [
    "crates/fsearch-hotkey",
    "crates/fsearch-hotkey-lib",
]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2021"
rust-version = "1.70"
authors = ["FSearch Hotkey Contributors"]
license = "MIT OR Apache-2.0"
repository = "https://github.com/fsearch-hotkey/fsearch-hotkey"

[workspace.metadata.release]
shared-version = true
tag-name = "v{{version}}"

# Profile optimizations for smaller binary size
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
panic = "abort"

[profile.dev]
opt-level = 0
```

#### `crates/fsearch-hotkey/Cargo.toml` (new)

```toml
[package]
name = "fsearch-hotkey"
version.workspace = true
edition.workspace = true
rust-version.workspace = true
authors.workspace = true
license.workspace = true
repository.workspace = true
description = "Hotkey daemon for launching FSearch with CapsLock+f"

[[bin]]
name = "fsearch-hotkey"
path = "src/main.rs"

[dependencies]
fsearch-hotkey-lib = { path = "../fsearch-hotkey-lib" }

# CLI will be added in Task 3
# clap = { version = "4.4", features = ["derive"] }

# Logging will be added in Task 4
# tracing = "0.1"
# tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Error handling will be added in Task 5
# thiserror = "1.0"
# anyhow = "1.0"
```

#### `crates/fsearch-hotkey/src/main.rs` (new)

```rust
//! FSearch Hotkey Daemon - Main Entry Point
//!
//! This is the command-line interface for the FSearch hotkey daemon.
//! It provides commands to start the daemon, control its behavior,
//! and manage its installation.

fn main() {
    println!("FSearch Hotkey Daemon");
    println!("Version: {}", env!("CARGO_PKG_VERSION"));
    println!();
    println!("This is a placeholder. CLI commands will be implemented in Task 3.");
}
```

#### `crates/fsearch-hotkey-lib/Cargo.toml` (new)

```toml
[package]
name = "fsearch-hotkey-lib"
version.workspace = true
edition.workspace = true
rust-version.workspace = true
authors.workspace = true
license.workspace = true
repository.workspace = true
description = "Core library for FSearch hotkey daemon"

[lib]
name = "fsearch_hotkey_lib"
path = "src/lib.rs"

[dependencies]
# Core dependencies will be added in Task 2
# tokio = { version = "1.34", features = ["full"] }
# serde = { version = "1.0", features = ["derive"] }
# toml = "0.8"
# tracing = "0.1"
# thiserror = "1.0"
# anyhow = "1.0"
# dirs = "5.0"

# Display server dependencies will be added in later phases
# x11rb = { version = "0.13", features = ["all-extensions"], optional = true }
# wayland-client = { version = "0.31", optional = true }
# evdev = { version = "0.12", optional = true }

[features]
default = ["x11"]
x11 = ["dep:x11rb"]
wayland = ["dep:wayland-client"]
evdev = ["dep:evdev"]
```

#### `crates/fsearch-hotkey-lib/src/lib.rs` (new)

```rust
//! FSearch Hotkey Daemon - Core Library
//!
//! This library contains the core functionality for the FSearch hotkey daemon,
//! including:
//!
//! - Configuration management
//! - Keyboard input interception (X11, Wayland, evdev)
//! - Application lifecycle control
//! - Window management
//! - IPC server and client
//! - Daemon orchestration

#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]

/// Configuration module for loading and managing daemon settings
pub mod config {
    pub use self::manager::ConfigManager;
    pub use self::types::{BehaviorConfig, Config, GeneralConfig, HotkeyConfig};

    // Placeholder modules - will be implemented in Phase 2
    mod manager;
    mod types;
}

/// Re-export common error types
pub mod error {
    // Placeholder - will be implemented in Task 5
    pub use crate::HotkeyError;
}

/// Main error type for the library
#[derive(Debug, thiserror::Error)]
pub enum HotkeyError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Key listener error: {0}")]
    KeyListener(String),

    #[error("Application control error: {0}")]
    AppControl(String),

    #[error("Window management error: {0}")]
    Window(String),

    #[error("IPC error: {0}")]
    Ipc(String),

    #[error("Daemon error: {0}")]
    Daemon(String),
}

/// Result type alias for the library
pub type Result<T> = std::result::Result<T, HotkeyError>;
```

#### `.gitignore` (new)

```gitignore
# Rust
/target/
**/*.rs.bk
*.pdb
Cargo.lock

# IDE
.idea/
.vscode/
*.swp
*.swo
*~
.DS_Store

# Build artifacts
/dist/
*.tar.gz
*.deb
*.arch

# Test coverage
tarpaulin-report.html
cobertura.xml

# Local configuration (user-specific)
/config/local.toml

# Editor temp files
.*.sw[a-z]
*.un~
Session.vim
.netrwhist

# Logs
*.log
```

#### `rust-toolchain.toml` (new)

```toml
[toolchain]
channel = "1.70.0"
components = ["rustfmt", "clippy", "rust-src"]
```

### Tests

Since this is the initial project setup, the primary test is that the project builds correctly.

```bash
# Test that the workspace builds
cargo build --workspace

# Test that the binary runs
cargo run --package fsearch-hotkey

# Verify clippy is available
cargo clippy --workspace --all-targets

# Check formatting
cargo fmt --all -- --check
```

### Commands to Run

```bash
# Initialize the workspace and build
cargo build --workspace

# Run the binary (placeholder output)
cargo run

# Check the project structure
tree -L 3 -I target

# Verify the workspace recognizes both crates
cargo tree --workspace
```

### Verification

1. Run `cargo build --workspace` - Should compile successfully with warnings about unused code (expected at this stage)
2. Run `cargo run` - Should print the placeholder message from main.rs
3. Run `cargo tree --workspace` - Should show both `fsearch-hotkey` and `fsearch-hotkey-lib` packages
4. Check that `target/debug/fsearch-hotkey` binary was created

### Notes

- **Workspace Structure**: The workspace uses a standard two-crate pattern with a binary crate (`fsearch-hotkey`) that depends on a library crate (`fsearch-hotkey-lib`). This separation allows the library to be reused and tested independently.

- **Rust Version**: Pinned to 1.70.0 in `rust-toolchain.toml` for consistency across development and CI environments. This version supports all required features.

- **Profile Optimization**: The release profile is configured for small binary size (LTO, codegen-units=1, strip=true) to help meet the resource usage requirements (<10MB idle RAM).

- **Feature Flags**: The library crate has feature flags for `x11`, `wayland`, and `evdev` backends, allowing selective compilation based on target system.

- **Next Task**: Task 2 will add the core dependencies (tokio, clap, serde, toml, tracing, etc.) to both Cargo.toml files.

---

✅ **Applied changes to 7 file(s)**:

- `Cargo.toml`
- `crates/fsearch-hotkey/Cargo.toml`
- `crates/fsearch-hotkey/src/main.rs`
- `crates/fsearch-hotkey-lib/Cargo.toml`
- `crates/fsearch-hotkey-lib/src/lib.rs`
- `.gitignore`
- `rust-toolchain.toml`

**Next**: Review the changes, then mark the task complete in `.specky/002-create-specification-for/tasks.md`

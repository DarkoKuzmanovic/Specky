\# Changelog

All notable changes to the Specky extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-01-12

### Security

- **H-1**: Fixed XSS vulnerability in dashboard webview

  - Added strict Content Security Policy (CSP) with nonce
  - Implemented HTML escaping for all dynamic content (feature names, IDs)
  - Removed all inline event handlers, replaced with event delegation

- **H-2**: Removed remote script dependency

  - Replaced unpkg.com Phosphor icons with bundled VS Code codicons
  - CSP now restricts to local resources only

- **M-1**: Added path traversal protection

  - Feature IDs now validated against known features before opening artifacts

- **M-4**: Added workspace trust support
  - Extension now respects `vscode.workspace.isTrusted`
  - Declared `capabilities.untrustedWorkspaces` in package.json

### Fixed

- **M-2**: Dashboard feature selection now syncs with tree view, status bar, and chat participant
- **M-3**: Empty feature names now fallback to "new-feature" instead of creating invalid directories
- **L-1**: Active feature data now refreshes from updated list to avoid stale display
- **L-2**: Fixed UTF-8 decoding of package.json when reading workspace context
- **L-3**: Task nesting now properly handles multiple indentation levels

### Changed

- Migrated from Phosphor icons to VS Code codicons for better integration
- Updated ChatFollowup `message` property to `label` for API compatibility

### Added

- `/implement` QoL flags: task selection (`/implement 3` or `--task 3`) and `--dry-run` diff preview
- WorkspaceEdit-based code application for `/implement` (single-step undo support)
- Command links for running suggested shell commands with confirmation (`specky.runInTerminal`)
- Smart context injection: task-referenced files are read and included as ground truth

### Changed

- Dashboard Help content updated to document new `/implement` options

## [0.1.0] - 2026-01-11

### Added

- **@specky Chat Participant** - Integrates with GitHub Copilot Chat

  - `/specify` - Generate or refine specifications from ideas
  - `/clarify` - Identify ambiguities and missing requirements
  - `/plan` - Create technical implementation plans
  - `/tasks` - Break plans into implementable task lists
  - `/implement` - Implement tasks after quality gates pass

- **Model Selection**

  - Default models: Claude Opus 4.5 (planning), Claude Sonnet 4.5 (implementation)
  - Inline `--model` override: `@specky /plan --model gpt-4o`
  - Configurable via settings: `specky.planningModel`, `specky.implementationModel`
  - Silent fallback to available model if preferred not available

- **Multi-Feature Support**

  - Numbered feature directories: `.specky/001-feature-name/`
  - Each feature has: `spec.md`, `plan.md`, `tasks.md`
  - Easy switching between features

- **Quality Gates**

  - Validates artifacts before allowing `/implement`
  - Checks for spec, plan, and tasks existence
  - Validates spec completeness (required sections)
  - Warns about TODOs and incomplete content

- **Progress Tracking**

  - Parses task checkboxes from `tasks.md`
  - Tracks completion percentage
  - Syncs with file changes automatically

- **Visual Dashboard**

  - Webview panel showing all features
  - Progress visualization with bars
  - Quick action buttons for commands
  - Artifact status indicators

- **Explorer Tree View**

  - Shows features in the Explorer panel
  - Displays artifacts per feature
  - Progress indicator in tree

- **Status Bar**
  - Shows active feature and progress
  - Quick access to dashboard

### Technical Details

- Minimum VS Code version: 1.93.0
- Extension dependency: `github.copilot-chat`
- TypeScript with ES2022 target
- Graceful degradation when Copilot unavailable

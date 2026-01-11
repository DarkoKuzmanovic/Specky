\# Changelog

All notable changes to the Specky extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-XX

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

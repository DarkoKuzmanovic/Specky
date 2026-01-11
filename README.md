# Specky

Spec-driven development workflow for GitHub Copilot. Transform ideas into specifications, plans, and working code.

## Features

- **@specky /specify** - Generate or refine specifications from your ideas
- **@specky /plan** - Create technical plans from specifications
- **@specky /tasks** - Break plans into implementable tasks
- **@specky /implement** - Implement tasks (requires quality gates to pass)
- **@specky /clarify** - Identify and resolve specification ambiguities

## Requirements

- VS Code 1.93.0 or later
- [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)

## Usage

1. Open GitHub Copilot Chat (Ctrl+Shift+I / Cmd+Shift+I)
2. Start with `@specky /specify <your idea>`
3. Follow the workflow: specify → clarify → plan → tasks → implement

### Model Selection

By default, Specky uses Claude Opus 4.5 for planning and Claude Sonnet 4.5 for implementation.

Override inline with `--model`:

```text
@specky /plan --model gpt-4o What's the architecture for this?
```

Configure defaults in settings:

```json
{
  "specky.planningModel": "claude-opus-4.5",
  "specky.implementationModel": "claude-sonnet-4.5"
}
```

## Multi-Feature Support

Specky organizes features in numbered directories:

```text
.specky/
├── 001-user-auth/
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md
├── 002-payment-integration/
│   ├── spec.md
│   └── plan.md
└── 003-dashboard/
    └── spec.md
```

## Extension Settings

| Setting                      | Default             | Description                                 |
| ---------------------------- | ------------------- | ------------------------------------------- |
| `specky.planningModel`       | `claude-opus-4.5`   | Model for /specify, /plan, /tasks, /clarify |
| `specky.implementationModel` | `claude-sonnet-4.5` | Model for /implement                        |

## Commands

- **Specky: Open Dashboard** - Open the visual dashboard
- **Specky: Create New Specification** - Start a new feature
- **Specky: Refresh Artifacts** - Reload the tree view

## License

MIT © Darko Kuzmanovic

## Links

- [GitHub Repository](https://github.com/DarkoKuzmanovic/specky)
- [Report Issues](https://github.com/DarkoKuzmanovic/specky/issues)

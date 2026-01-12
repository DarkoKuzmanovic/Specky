# Specky

Spec-driven development workflow for GitHub Copilot. Transform ideas into specifications, plans, and working code.

## Getting Started

1. **Install Requirements**: Ensure you have [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) and VS Code 1.93.0 or later.
2. **Open a Workspace**: Specky requires an open folder to store its artifacts.
3. **Start a Feature**: Run the **Specky: Create New Specification** command from the Command Palette (Ctrl+Shift+P) or start chat with `@specky /specify <your idea>`.

## Workflow

Specky follows a structured lifecycle to ensure high-quality implementation:

1. **Specify** (`/specify`): Define what you're building. Creates `spec.md`.
2. **Clarify** (`/clarify`): Identify ambiguities or missing requirements in your spec.
3. **Plan** (`/plan`): Determine _how_ to build it. Creates `plan.md`.
4. **Tasks** (`/tasks`): Break the plan into actionable items. Creates `tasks.md`.
5. **Implement** (`/implement`): Code the solution. Requires Quality Gates to pass.

### Implement Options

`/implement` supports a few optional flags to make iteration safer and faster:

- `--review`: run a code review step before auto-completing the task.
- `--dry-run`: preview proposed file changes in diff views without writing any files.
- `--task <n>` (or `/implement <n>`): select a specific task by 1-based index.
- `--model <name>`: override the implementation model for this run.

Examples:

```text
@specky /implement --review
@specky /implement 3 --dry-run
@specky /implement --task 2 --model gpt-4o
```

### Quality Gates

Before `/implement` can proceed, Specky runs quality checks:

- **Errors (Blocking)**: Missing `spec.md`, `plan.md`, or `tasks.md`.
- **Warnings (Non-blocking)**: Missing sections (Overview, Requirements, AC), length checks, or TODO markers.

### Multi-Feature Support

Specky organizes features in numbered directories under the canonical `.specky/` folder:

```text
.specky/
├── 001-user-auth/
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md
└── 002-dashboard/
    └── spec.md
```

Select an "Active Feature" via the Explorer tree to control which feature `@specky` commands target.

## User Interface

- **Dashboard**: Run **Specky: Open Dashboard** for a visual overview of all features and their progress.
- **Explorer Tree**: Access features and artifacts directly from the VS Code Sidebar. Use the **Model Settings** node to configure per-command models.
- **Status Bar**: Displays the currently active feature and its completion percentage. Click to open the Dashboard.

## Settings

Specky allows granular control over which models are used for each stage of the workflow.

| Setting                      | Default             | Description                            |
| ---------------------------- | ------------------- | -------------------------------------- |
| `specky.planningModel`       | `claude-opus-4.5`   | General fallback for planning commands |
| `specky.implementationModel` | `claude-sonnet-4.5` | Model for `/implement`                 |
| `specky.specifyModel`        | `claude-opus-4.5`   | Specific model for `/specify`          |
| `specky.planModel`           | `claude-opus-4.5`   | Specific model for `/plan`             |
| `specky.tasksModel`          | `claude-sonnet-4.5` | Specific model for `/tasks`            |

### Model Overrides

You can override models inline in chat:

```text
@specky /plan --model gpt-4o What's the architecture for this?
```

## Troubleshooting

- **No Active Feature**: If you have multiple features, `@specky` will prompt you to pick one unless you've set an active one in the tree view.
- **Implementation Blocked**: Ensure all files exist. Warnings (like missing sections) won't stop implementation, but missing artifacts will.
- **Task Detection**: Specky relies on standard Markdown checkboxes (`- [ ]` or `- [x]`). Ensure your `tasks.md` uses this format.
- **Dry-Run Preview**: If you want to inspect changes before applying, use `@specky /implement --dry-run`.
- **Run Links**: If Specky shows clickable “Run” links for shell commands, they will always ask for confirmation before sending text to a terminal.
- **Workspace Required**: Specky functionality is disabled until a folder is opened.

## License

MIT © Darko Kuzmanovic [quz.ma](https://quz.ma)

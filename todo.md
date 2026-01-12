[x] After being processed, tasks don't get implemented. Is it debug mode thing, or there's an issue with the extension itself.

> ✅ Enhanced /implement to parse code blocks from LLM response and automatically apply them to workspace files. Supports both new file creation and modifications with intelligent merge strategy.
> ✅ Added auto-complete: tasks are now automatically marked complete after successful implementation
> ✅ Added optional `--review` flag: triggers code review with configurable review model before completing
> [x] Changing /plan to GLM in extension's sidebar doesn't change it in execution panel, only through webview dashboard does
> ✅ Configuration sync works correctly - fixed ESLint errors that were blocking debugging

## Future QoL Improvements

- [x] **Task Selection**: Support `/implement 3` or `--task 3` to select a specific task by index.
  > ✅ Completed: Added task selection via `--task` and leading numeric selector.
- [x] **Safe Edits (Undo Support)**: Apply code changes via VS Code `WorkspaceEdit` so the whole apply step is undoable.
  > ✅ Completed: Switched file application to `vscode.workspace.applyEdit()`.
- [x] **Terminal Command Buttons**: Detect shell commands in implementation responses and render “Run” command links.
  > ✅ Completed: Extracts bash/sh fenced blocks and renders one-click run links with confirmation.
- [x] **Smart Context**: When a task references files, auto-include their contents during `/implement`.
  > ✅ Completed: Injects referenced files (bounded) into the model prompt as ground truth.
- [x] **Diff Preview**: Add a `--dry-run` flag to `/implement` that opens diff previews instead of applying.
  > ✅ Completed: Opens `vscode.diff` previews per proposed file and applies nothing.

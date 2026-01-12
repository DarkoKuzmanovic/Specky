/**
 * Specky - Chat Participant
 * Main chat participant that handles @specky commands
 */

import * as vscode from "vscode";
import { SpeckyCommand, Feature, Task } from "../types.js";
import { SpeckyFileManager } from "../services/fileManager.js";
import { ModelSelector } from "../services/modelSelector.js";
import { QualityGateService } from "../services/qualityGate.js";
import { ProgressTracker } from "../services/progressTracker.js";
import { CommandPrompts } from "./prompts.js";

const PARTICIPANT_ID = "specky.specky";

/**
 * Follow-up suggestions for each command to guide users through the workflow
 */
const FOLLOWUP_MAP: Record<string, vscode.ChatFollowup[]> = {
  specify: [
    { prompt: "/clarify", label: "Identify ambiguities", command: "clarify" },
    { prompt: "/plan", label: "Create technical plan", command: "plan" },
  ],
  plan: [{ prompt: "/tasks", label: "Break down into tasks", command: "tasks" }],
  tasks: [{ prompt: "/implement", label: "Start implementing", command: "implement" }],
  clarify: [
    { prompt: "/specify", label: "Update specification", command: "specify" },
    { prompt: "/plan", label: "Proceed to planning", command: "plan" },
  ],
  implement: [{ prompt: "/implement", label: "Implement next task", command: "implement" }],
};

export class SpeckyChatParticipant {
  private participant: vscode.ChatParticipant;
  private activeFeature: Feature | null = null;

  private static readonly MAX_SMART_CONTEXT_CHARS = 20_000;

  constructor(
    private readonly fileManager: SpeckyFileManager,
    private readonly modelSelector: ModelSelector,
    private readonly qualityGate: QualityGateService,
    private readonly progressTracker: ProgressTracker
  ) {
    this.participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, this.handleRequest.bind(this));

    this.participant.iconPath = new vscode.ThemeIcon("checklist");

    // Register follow-up provider for intelligent next-step suggestions
    this.participant.followupProvider = {
      provideFollowups: (
        result: vscode.ChatResult,
        _context: vscode.ChatContext,
        _token: vscode.CancellationToken
      ): vscode.ProviderResult<vscode.ChatFollowup[]> => {
        const command = result.metadata?.command as string | undefined;
        if (!command || command === "error" || command === "help") {
          return [];
        }
        return FOLLOWUP_MAP[command] || [];
      },
    };
  }

  /**
   * Gathers workspace context for implementation guidance
   * Reads package.json and existing code patterns
   */
  private async getWorkspaceContext(): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return "";
    }

    const context: string[] = [];

    try {
      // Read package.json for project info
      const packageJsonUri = vscode.Uri.joinPath(workspaceFolders[0].uri, "package.json");
      const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonUri);
      // L-2: Properly decode Uint8Array to UTF-8 string before JSON parsing
      const packageJson = JSON.parse(Buffer.from(packageJsonContent).toString("utf-8"));

      context.push(`<project_info>`);
      context.push(`Name: ${packageJson.name || "unknown"}`);
      context.push(`Type: ${packageJson.type || "commonjs"}`);
      if (packageJson.dependencies) {
        context.push(`Dependencies: ${Object.keys(packageJson.dependencies).join(", ")}`);
      }
      if (packageJson.devDependencies) {
        context.push(`Dev Dependencies: ${Object.keys(packageJson.devDependencies).join(", ")}`);
      }
      context.push(`</project_info>`);
    } catch {
      // package.json not found or invalid - that's okay
    }

    try {
      // Check for TypeScript config
      const tsconfigUri = vscode.Uri.joinPath(workspaceFolders[0].uri, "tsconfig.json");
      await vscode.workspace.fs.stat(tsconfigUri);
      context.push(`<typescript>Project uses TypeScript</typescript>`);
    } catch {
      // No tsconfig - that's okay
    }

    return context.join("\n");
  }

  private async handleRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const command = request.command as SpeckyCommand | undefined;

    try {
      // Ensure we have an active feature or prompt for one
      if (!this.activeFeature && command !== "specify") {
        this.activeFeature = await this.ensureActiveFeature(stream);
        if (!this.activeFeature) {
          stream.markdown("No active feature. Use `/specify` to create a new specification first.");
          return { metadata: { command: "error" } };
        }
      }

      switch (command) {
        case "specify":
          return await this.handleSpecify(request, context, stream, token);
        case "plan":
          return await this.handlePlan(request, context, stream, token);
        case "tasks":
          return await this.handleTasks(request, context, stream, token);
        case "implement":
          return await this.handleImplement(request, context, stream, token);
        case "clarify":
          return await this.handleClarify(request, context, stream, token);
        default:
          return await this.handleGeneral(request, context, stream, token);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      stream.markdown(`❌ **Error**: ${message}`);
      return { metadata: { command: "error" } };
    }
  }

  private async ensureActiveFeature(stream: vscode.ChatResponseStream): Promise<Feature | null> {
    const features = await this.fileManager.listFeatures();

    if (features.length === 0) {
      return null;
    }

    if (features.length === 1) {
      const feature = features[0];
      this.activeFeature = feature;
      stream.markdown(`📁 Using feature: **${feature.name}**\n\n`);
      return feature;
    }

    // Multiple features - show picker
    const items = features.map((f) => ({
      label: f.name,
      description: `${f.progress.completedTasks}/${f.progress.totalTasks} tasks`,
      feature: f,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a feature to work on",
    });

    if (selected) {
      this.activeFeature = selected.feature;
      return this.activeFeature;
    }

    return null;
  }

  private async handleSpecify(
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const { model: targetModel, cleanPrompt } = this.modelSelector.getEffectiveModel("specify", request.prompt);

    stream.markdown(`📝 **Creating Specification** (using ${this.modelSelector.getModelDisplayName(targetModel)})\n\n`);

    // Check if this is a new feature or refining existing
    if (!cleanPrompt.trim() && !this.activeFeature) {
      stream.markdown("Please provide a description of what you want to build.\n\n");
      stream.markdown(
        "**Example**: `@specky /specify Build a user authentication system with email/password and OAuth support`"
      );
      return { metadata: { command: "specify" } };
    }

    // Create new feature if needed
    if (!this.activeFeature) {
      const name = this.extractFeatureName(cleanPrompt);
      this.activeFeature = await this.fileManager.createFeature(name);
      stream.markdown(`✨ Created feature: **${this.activeFeature.name}**\n\n`);
    }

    const activeFeature = this.activeFeature;

    // Get model and generate
    const chatModel = await this.modelSelector.selectModel(targetModel, request.model);
    const systemPrompt = CommandPrompts.specify(activeFeature.name);
    const userPrompt = cleanPrompt || "Generate a detailed specification based on the feature name.";

    const messages = [
      vscode.LanguageModelChatMessage.User(systemPrompt),
      vscode.LanguageModelChatMessage.User(userPrompt),
    ];

    const response = await chatModel.sendRequest(messages, {}, token);

    let content = "";
    for await (const chunk of response.text) {
      stream.markdown(chunk);
      content += chunk;
    }

    // Save to file
    await this.fileManager.writeArtifact(activeFeature.id, "spec", content);

    stream.markdown("\n\n---\n");
    stream.markdown(`✅ Saved to \`.specky/${activeFeature.id}/spec.md\`\n\n`);
    stream.markdown("**Next step**: Use `/clarify` to identify ambiguities or `/plan` to create the technical plan.");

    return { metadata: { command: "specify" } };
  }

  private async handlePlan(
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const { model: targetModel, cleanPrompt } = this.modelSelector.getEffectiveModel("plan", request.prompt);

    if (!this.activeFeature) {
      stream.markdown("❌ No active feature. Use `/specify` first.");
      return { metadata: { command: "plan" } };
    }

    stream.markdown(
      `🏗️ **Creating Plan** for ${this.activeFeature.name} (using ${this.modelSelector.getModelDisplayName(
        targetModel
      )})\n\n`
    );

    // Read spec
    const spec = await this.fileManager.readArtifact(this.activeFeature.id, "spec");
    if (!spec) {
      stream.markdown("❌ No specification found. Use `/specify` first.");
      return { metadata: { command: "plan" } };
    }

    const chatModel = await this.modelSelector.selectModel(targetModel, request.model);
    const systemPrompt = CommandPrompts.plan(this.activeFeature.name, spec);
    const userPrompt = cleanPrompt || "Create a detailed technical plan for implementing this specification.";

    const messages = [
      vscode.LanguageModelChatMessage.User(systemPrompt),
      vscode.LanguageModelChatMessage.User(userPrompt),
    ];

    const response = await chatModel.sendRequest(messages, {}, token);

    let content = "";
    for await (const chunk of response.text) {
      stream.markdown(chunk);
      content += chunk;
    }

    await this.fileManager.writeArtifact(this.activeFeature.id, "plan", content);

    stream.markdown("\n\n---\n");
    stream.markdown(`✅ Saved to \`.specky/${this.activeFeature.id}/plan.md\`\n\n`);
    stream.markdown("**Next step**: Use `/tasks` to break down into implementable tasks.");

    return { metadata: { command: "plan" } };
  }

  private async handleTasks(
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const { model: targetModel, cleanPrompt } = this.modelSelector.getEffectiveModel("tasks", request.prompt);

    if (!this.activeFeature) {
      stream.markdown("❌ No active feature. Use `/specify` first.");
      return { metadata: { command: "tasks" } };
    }

    stream.markdown(
      `📋 **Creating Tasks** for ${this.activeFeature.name} (using ${this.modelSelector.getModelDisplayName(
        targetModel
      )})\n\n`
    );

    // Read spec and plan
    const spec = await this.fileManager.readArtifact(this.activeFeature.id, "spec");
    const plan = await this.fileManager.readArtifact(this.activeFeature.id, "plan");

    if (!spec || !plan) {
      stream.markdown("❌ Missing specification or plan. Complete those steps first.");
      return { metadata: { command: "tasks" } };
    }

    const chatModel = await this.modelSelector.selectModel(targetModel, request.model);
    const systemPrompt = CommandPrompts.tasks(this.activeFeature.name, spec, plan);
    const userPrompt = cleanPrompt || "Break down the plan into specific, implementable tasks with checkboxes.";

    const messages = [
      vscode.LanguageModelChatMessage.User(systemPrompt),
      vscode.LanguageModelChatMessage.User(userPrompt),
    ];

    const response = await chatModel.sendRequest(messages, {}, token);

    let content = "";
    for await (const chunk of response.text) {
      stream.markdown(chunk);
      content += chunk;
    }

    await this.fileManager.writeArtifact(this.activeFeature.id, "tasks", content);

    stream.markdown("\n\n---\n");
    stream.markdown(`✅ Saved to \`.specky/${this.activeFeature.id}/tasks.md\`\n\n`);
    stream.markdown("**Next step**: Use `/implement` to start implementing tasks.");

    return { metadata: { command: "tasks" } };
  }

  private async handleImplement(
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    // Parse implementation-specific flags (--review, --model)
    const flags = this.modelSelector.parseImplementFlags(request.prompt);
    const targetModel = flags.model || this.modelSelector.getConfiguredModel("implement");

    if (!this.activeFeature) {
      stream.markdown("❌ No active feature. Use `/specify` first.");
      return { metadata: { command: "implement" } };
    }

    stream.markdown(`🔍 **Running Quality Gates** for ${this.activeFeature.name}...\n\n`);

    // Run quality gates
    const gateResult = await this.qualityGate.validateForImplementation(this.activeFeature.id);
    stream.markdown(this.qualityGate.formatResults(gateResult));
    stream.markdown("\n\n");

    if (!gateResult.passed) {
      stream.markdown("❌ **Cannot proceed with implementation.** Resolve the errors above first.");
      return { metadata: { command: "implement" } };
    }

    stream.markdown(`🚀 **Implementing** (using ${this.modelSelector.getModelDisplayName(targetModel)})\n\n`);

    // Get selected task (or next incomplete)
    const selectedTask = await this.getSelectedTask(this.activeFeature.id, flags.taskNumber);
    const nextTask = selectedTask;
    if (!nextTask) {
      stream.markdown("✅ All tasks are complete! No more tasks to implement.");
      return { metadata: { command: "implement" } };
    }

    if (flags.taskNumber) {
      stream.markdown(`**Selected task** (#${flags.taskNumber}): ${nextTask.title}\n\n`);
    } else {
      stream.markdown(`**Current task**: ${nextTask.title}\n\n`);
    }

    // Read all artifacts
    const spec = await this.fileManager.readArtifact(this.activeFeature.id, "spec");
    const plan = await this.fileManager.readArtifact(this.activeFeature.id, "plan");
    const tasks = await this.fileManager.readArtifact(this.activeFeature.id, "tasks");

    // Gather workspace context for implementation guidance
    const workspaceContext = await this.getWorkspaceContext();

    // Smart context: pull in referenced file contents from the task itself
    const smartContext = await this.getSmartContextFromTask(nextTask.title);

    const chatModel = await this.modelSelector.selectModel(targetModel, request.model);
    const systemPrompt = CommandPrompts.implement(
      this.activeFeature.name,
      spec || "",
      plan || "",
      tasks || "",
      nextTask.title,
      workspaceContext || undefined
    );
    const userPrompt = flags.cleanPrompt || `Implement the task: "${nextTask.title}"`;

    const messages = [
      vscode.LanguageModelChatMessage.User(systemPrompt),
      ...(smartContext ? [vscode.LanguageModelChatMessage.User(smartContext)] : []),
      vscode.LanguageModelChatMessage.User(userPrompt),
    ];

    const response = await chatModel.sendRequest(messages, {}, token);

    let fullResponse = "";
    for await (const chunk of response.text) {
      stream.markdown(chunk);
      fullResponse += chunk;
    }

    stream.markdown("\n\n---\n");

    // Parse and apply (or preview) code changes from the response
    const changeSet = await this.parseCodeChanges(fullResponse);

    if (changeSet.length === 0) {
      stream.markdown("⚠️ No code blocks with file paths were found in the response.\n");
      stream.markdown(
        "The LLM may have provided instructions instead of code. Please implement manually or try again.\n"
      );
      return { metadata: { command: "implement" } };
    }

    if (flags.dryRun) {
      const previewed = await this.previewCodeChanges(changeSet);
      stream.markdown(`✅ **Dry-run preview opened for ${previewed} file(s)**. No files were modified.\n\n`);
      stream.markdown("Tip: Re-run without `--dry-run` to apply the changes.\n");
      return { metadata: { command: "implement" } };
    }

    const appliedFiles = await this.applyCodeChanges(changeSet);

    if (appliedFiles.length > 0) {
      stream.markdown(`✅ **Applied changes to ${appliedFiles.length} file(s)**:\n\n`);
      for (const file of appliedFiles) {
        stream.markdown(`- \`${file}\`\n`);
      }
      stream.markdown("\n");

      // Detect commands and offer clickable command links (terminal run helpers)
      const commands = this.extractShellCommands(fullResponse);
      if (commands.length > 0) {
        stream.markdown("---\n\n");
        stream.markdown("### Commands\n\n");
        stream.markdown("Click to run in a terminal (you will be asked to confirm):\n\n");
        for (const cmd of commands) {
          const link = this.makeCommandLink("specky.runInTerminal", [cmd], `Run: ${cmd}`);
          stream.markdown(`- ${link}\n`);
        }
        stream.markdown("\n");
      }

      // Optional review step if --review flag was passed
      if (flags.review) {
        stream.markdown("---\n\n");
        await this.runCodeReview(
          stream,
          token,
          request.model,
          this.activeFeature.name,
          nextTask.title,
          appliedFiles,
          fullResponse
        );
      }

      // Auto-complete the task if setting is enabled
      const shouldAutoComplete = this.modelSelector.shouldAutoCompleteTask();
      if (shouldAutoComplete) {
        try {
          await this.progressTracker.toggleTask(this.activeFeature.id, nextTask.id);
          stream.markdown(`\n✅ **Task marked complete**: ${nextTask.title}\n\n`);

          // Check if there are more tasks
          const remainingTask = await this.progressTracker.getNextTask(this.activeFeature.id);
          if (remainingTask) {
            stream.markdown(`**Next task**: ${remainingTask.title}\n`);
            stream.markdown("Run `/implement` again to continue.\n");
          } else {
            stream.markdown("🎉 **All tasks are now complete!**\n");
          }
        } catch {
          stream.markdown(
            `⚠️ Could not auto-mark task complete. Please mark manually in \`.specky/${this.activeFeature.id}/tasks.md\`\n`
          );
        }
      } else {
        stream.markdown(`**Next**: Mark the task complete in \`.specky/${this.activeFeature.id}/tasks.md\`\n`);
      }
    } else {
      stream.markdown("⚠️ No files were modified.\n");
    }

    return { metadata: { command: "implement" } };
  }

  /**
   * Run a code review on the implementation using a more powerful model
   */
  private async runCodeReview(
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    fallbackModel: vscode.LanguageModelChat,
    featureName: string,
    taskTitle: string,
    appliedFiles: string[],
    implementationOutput: string
  ): Promise<void> {
    const reviewModelName = this.modelSelector.getReviewModel();
    stream.markdown(
      `🔍 **Running Code Review** (using ${this.modelSelector.getModelDisplayName(reviewModelName)})\n\n`
    );

    try {
      const reviewModel = await this.modelSelector.selectModel(reviewModelName, fallbackModel);
      const reviewPrompt = CommandPrompts.review(featureName, taskTitle, appliedFiles, implementationOutput);

      const messages = [
        vscode.LanguageModelChatMessage.User(reviewPrompt),
        vscode.LanguageModelChatMessage.User("Please review this implementation."),
      ];

      const response = await reviewModel.sendRequest(messages, {}, token);

      for await (const chunk of response.text) {
        stream.markdown(chunk);
      }

      stream.markdown("\n\n");
    } catch {
      stream.markdown("⚠️ Code review failed. Proceeding without review.\n\n");
    }
  }

  /**
   * Parse code blocks from LLM response and apply them to files
   * Supports both new files and modifications to existing files
   *
   * Expected format from LLM:
   * #### `path/to/file.ts` (new)
   * ```typescript
   * code here
   * ```
   */
  private async applyCodeChanges(changes: ParsedFileChange[]): Promise<string[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const workspaceRoot = workspaceFolders[0].uri;
    const appliedFiles: string[] = [];
    const edit = new vscode.WorkspaceEdit();

    for (const change of changes) {
      const safeUri = this.safeResolveWorkspaceFile(workspaceRoot, change.path);
      if (!safeUri) {
        continue;
      }

      try {
        let exists = true;
        try {
          await vscode.workspace.fs.stat(safeUri);
        } catch {
          exists = false;
        }

        if (!exists) {
          edit.createFile(safeUri, { ignoreIfExists: true });
          edit.insert(safeUri, new vscode.Position(0, 0), change.content);
          appliedFiles.push(change.path);
          continue;
        }

        const doc = await vscode.workspace.openTextDocument(safeUri);
        const existingContent = doc.getText();

        const shouldReplace =
          change.content.length > existingContent.length * 0.8 ||
          change.content.includes("/**") ||
          change.content.includes("/*") ||
          change.content.includes("import ") ||
          change.path.endsWith(".json") ||
          change.path.endsWith(".yaml") ||
          change.path.endsWith(".yml") ||
          change.path.endsWith(".md");

        const nextContent = shouldReplace ? change.content : this.mergeCodeChanges(existingContent, change.content);
        const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(existingContent.length));
        edit.replace(safeUri, fullRange, nextContent);
        appliedFiles.push(change.path);
      } catch {
        // Skip failures; apply remaining edits
      }
    }

    if (appliedFiles.length === 0) {
      return [];
    }

    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      return [];
    }

    // Save affected documents to persist changes to disk
    for (const filePath of appliedFiles) {
      const safeUri = this.safeResolveWorkspaceFile(workspaceRoot, filePath);
      if (!safeUri) {
        continue;
      }
      try {
        const doc = await vscode.workspace.openTextDocument(safeUri);
        await doc.save();
      } catch {
        // ignore
      }
    }

    return appliedFiles;
  }

  private async previewCodeChanges(changes: ParsedFileChange[]): Promise<number> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return 0;
    }
    const workspaceRoot = workspaceFolders[0].uri;

    let opened = 0;
    for (const change of changes) {
      const safeUri = this.safeResolveWorkspaceFile(workspaceRoot, change.path);
      if (!safeUri) {
        continue;
      }

      let exists = true;
      try {
        await vscode.workspace.fs.stat(safeUri);
      } catch {
        exists = false;
      }

      const rightDoc = await vscode.workspace.openTextDocument({
        content: change.content,
        language: this.guessLanguageId(change.path),
      });

      const leftUri = exists
        ? safeUri
        : (
            await vscode.workspace.openTextDocument({
              content: "",
              language: this.guessLanguageId(change.path),
            })
          ).uri;

      const title = exists ? `Preview: ${change.path}` : `Preview (new): ${change.path}`;
      await vscode.commands.executeCommand("vscode.diff", leftUri, rightDoc.uri, title);
      opened += 1;
    }

    return opened;
  }

  private async parseCodeChanges(response: string): Promise<ParsedFileChange[]> {
    const changes: ParsedFileChange[] = [];
    const fileBlockRegex = /####\s*`([^`]+)`[^\n]*\n```(?:\w+)?\n([\s\S]*?)\n```/g;

    let match;
    while ((match = fileBlockRegex.exec(response)) !== null) {
      const filePath = match[1]?.trim();
      const code = match[2];
      if (!filePath || filePath.length === 0 || code === undefined) {
        continue;
      }
      changes.push({ path: filePath, content: code });
    }

    return changes;
  }

  private safeResolveWorkspaceFile(workspaceRoot: vscode.Uri, relativePath: string): vscode.Uri | null {
    const normalized = relativePath.replace(/\\/g, "/").trim();

    if (normalized.length === 0) {
      return null;
    }

    if (normalized.startsWith("/") || normalized.startsWith("~")) {
      return null;
    }

    // Prevent traversal and other suspicious paths
    const segments = normalized.split("/");
    if (segments.some((s) => s === ".." || s === "." || s.length === 0)) {
      return null;
    }

    // Basic Windows drive guard
    if (/^[a-zA-Z]:/.test(normalized)) {
      return null;
    }

    return vscode.Uri.joinPath(workspaceRoot, ...segments);
  }

  private guessLanguageId(filePath: string): string {
    switch (true) {
      case filePath.endsWith(".ts"):
        return "typescript";
      case filePath.endsWith(".js"):
        return "javascript";
      case filePath.endsWith(".json"):
        return "json";
      case filePath.endsWith(".md"):
        return "markdown";
      case filePath.endsWith(".css"):
        return "css";
      case filePath.endsWith(".html"):
        return "html";
      case filePath.endsWith(".yml") || filePath.endsWith(".yaml"):
        return "yaml";
      default:
        return "plaintext";
    }
  }

  private makeCommandLink(commandId: string, args: unknown[], label: string): string {
    const encodedArgs = encodeURIComponent(JSON.stringify(args));
    return `[${label}](command:${commandId}?${encodedArgs})`;
  }

  private extractShellCommands(response: string): string[] {
    const commands: string[] = [];

    // Prefer bash fenced blocks
    const blockRegex = /```(?:bash|sh|shell)\n([\s\S]*?)\n```/gi;
    let blockMatch;
    while ((blockMatch = blockRegex.exec(response)) !== null) {
      const block = blockMatch[1] || "";
      for (const rawLine of block.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
          continue;
        }
        const stripped = line.startsWith("$") ? line.slice(1).trim() : line;
        if (!stripped) {
          continue;
        }
        commands.push(stripped);
      }
    }

    // De-dup while preserving order
    return Array.from(new Set(commands)).slice(0, 10);
  }

  private async getSelectedTask(featureId: string, taskNumber: number | null): Promise<Task | null> {
    if (!taskNumber) {
      return await this.progressTracker.getNextTask(featureId);
    }

    const tasks = await this.progressTracker.getTasks(featureId);
    const flat = this.flattenTasks(tasks);
    const idx = taskNumber - 1;
    if (idx < 0 || idx >= flat.length) {
      return null;
    }
    return flat[idx];
  }

  private flattenTasks(tasks: Task[]): Task[] {
    const out: Task[] = [];
    const walk = (items: Task[]) => {
      for (const task of items) {
        out.push(task);
        if (task.subtasks) {
          walk(task.subtasks);
        }
      }
    };
    walk(tasks);
    return out;
  }

  private async getSmartContextFromTask(taskTitle: string): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return "";
    }

    const workspaceRoot = workspaceFolders[0].uri;
    const paths = this.extractFilePathsFromText(taskTitle);
    if (paths.length === 0) {
      return "";
    }

    const chunks: string[] = [];
    let used = 0;

    for (const path of paths) {
      const safeUri = this.safeResolveWorkspaceFile(workspaceRoot, path);
      if (!safeUri) {
        continue;
      }
      try {
        const stat = await vscode.workspace.fs.stat(safeUri);
        if (stat.type !== vscode.FileType.File) {
          continue;
        }
        const content = Buffer.from(await vscode.workspace.fs.readFile(safeUri)).toString("utf-8");
        if (!content) {
          continue;
        }

        const header = `\n\n<file path="${path}">\n`;
        const footer = `\n</file>\n`;
        const remaining = SpeckyChatParticipant.MAX_SMART_CONTEXT_CHARS - used;
        if (remaining <= 0) {
          break;
        }
        const included = content.slice(0, Math.max(0, remaining - header.length - footer.length));
        if (!included) {
          break;
        }

        chunks.push(header + included + footer);
        used += header.length + included.length + footer.length;
      } catch {
        // ignore
      }
    }

    if (chunks.length === 0) {
      return "";
    }

    return `<smart_context>\nThe following files are referenced by the task. Use them as ground truth and avoid guessing.\n${chunks.join(
      "\n"
    )}\n</smart_context>`;
  }

  private extractFilePathsFromText(text: string): string[] {
    const found = new Set<string>();

    // Backticked paths: `src/foo.ts`
    for (const m of text.matchAll(/`([^`]+\.(?:ts|js|tsx|jsx|json|md|yml|yaml|css|html))`/gi)) {
      found.add(m[1]);
    }

    // Plain paths like src/foo.ts
    for (const m of text.matchAll(/\b([\w.-]+(?:\/[\w.-]+)+\.(?:ts|js|tsx|jsx|json|md|yml|yaml|css|html))\b/gi)) {
      found.add(m[1]);
    }

    return Array.from(found).slice(0, 6);
  }

  /**
   * Simple merge strategy: find matching code blocks and replace them
   * Looks for class/function/const declarations to identify sections
   */
  private mergeCodeChanges(existing: string, newCode: string): string {
    // Extract function/class/const names from the new code
    const declarationRegex = /^\s*(export\s+)?(async\s+)?(function|class|const|let|var|interface|type)\s+(\w+)/m;
    const match = newCode.match(declarationRegex);

    if (!match) {
      // Can't identify what to replace, do full replacement
      return newCode;
    }

    const name = match[4];

    // Find and replace matching declaration in existing code
    // This is a simple heuristic - looks for the same declaration
    const existingDeclRegex = new RegExp(
      `^\\s*(export\\s+)?(async\\s+)?(function|class|const|let|var|interface|type)\\s+${name}\\b`,
      "m"
    );

    if (!existingDeclRegex.test(existing)) {
      // Declaration doesn't exist, just append
      return existing + "\n\n" + newCode;
    }

    // Find the extent of the declaration and replace it
    // This is a simplified approach - for complex cases, full replacement is safer
    const lines = existing.split("\n");
    const newLines = newCode.split("\n");

    // Find the line with the declaration
    let startLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (existingDeclRegex.test(lines[i])) {
        startLine = i;
        break;
      }
    }

    if (startLine === -1) {
      return existing + "\n\n" + newCode;
    }

    // Simple heuristic: replace until the next declaration or end
    let endLine = lines.length;
    const nextDeclRegex = /^\s*(export\s+)?(async\s+)?(function|class|const|let|var|interface|type)\s+\w+/;

    for (let i = startLine + 1; i < lines.length; i++) {
      if (nextDeclRegex.test(lines[i])) {
        endLine = i;
        break;
      }
    }

    // Replace the section
    const result = [...lines.slice(0, startLine), ...newLines, ...lines.slice(endLine)].join("\n");

    return result;
  }

  private async handleClarify(
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const { model: targetModel, cleanPrompt } = this.modelSelector.getEffectiveModel("clarify", request.prompt);

    if (!this.activeFeature) {
      stream.markdown("❌ No active feature. Use `/specify` first.");
      return { metadata: { command: "clarify" } };
    }

    stream.markdown(
      `🔎 **Analyzing Specification** for ${this.activeFeature.name} (using ${this.modelSelector.getModelDisplayName(
        targetModel
      )})\n\n`
    );

    // Read spec
    const spec = await this.fileManager.readArtifact(this.activeFeature.id, "spec");
    if (!spec) {
      stream.markdown("❌ No specification found. Use `/specify` first.");
      return { metadata: { command: "clarify" } };
    }

    const chatModel = await this.modelSelector.selectModel(targetModel, request.model);
    const systemPrompt = CommandPrompts.clarify(this.activeFeature.name, spec);
    const userPrompt =
      cleanPrompt || "Identify any ambiguities, unclear requirements, or missing information in this specification.";

    const messages = [
      vscode.LanguageModelChatMessage.User(systemPrompt),
      vscode.LanguageModelChatMessage.User(userPrompt),
    ];

    const response = await chatModel.sendRequest(messages, {}, token);

    for await (const chunk of response.text) {
      stream.markdown(chunk);
    }

    stream.markdown("\n\n---\n");
    stream.markdown(
      "**Next step**: Address these clarifications, then use `/specify` to update the spec, or proceed to `/plan`."
    );

    return { metadata: { command: "clarify" } };
  }

  private async handleGeneral(
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    _token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    stream.markdown("# Welcome to Specky! 🎯\n\n");
    stream.markdown("Specky helps you build software through spec-driven development.\n\n");
    stream.markdown("## Available Commands\n\n");
    stream.markdown("- `/specify` - Generate or refine a specification\n");
    stream.markdown("- `/clarify` - Identify ambiguities in your spec\n");
    stream.markdown("- `/plan` - Create a technical plan\n");
    stream.markdown("- `/tasks` - Break down into implementable tasks\n");
    stream.markdown("- `/implement` - Implement tasks (auto-completes after success)\n\n");

    stream.markdown("## Implement Options\n\n");
    stream.markdown("- `--review` - Run code review with a more powerful model before completing\n");
    stream.markdown("- `--dry-run` - Preview changes in a diff view without writing files\n");
    stream.markdown("- `--task <n>` or `/implement <n>` - Select a specific task by index\n");
    stream.markdown("- `--model <name>` - Override the implementation model\n\n");
    stream.markdown("**Examples**: `@specky /implement --review`, `@specky /implement 3 --dry-run`\n\n");

    if (this.activeFeature) {
      stream.markdown(`**Active Feature**: ${this.activeFeature.name}\n`);
      stream.markdown(`**Progress**: ${this.progressTracker.formatProgress(this.activeFeature)}\n\n`);
    }

    stream.markdown("## Getting Started\n\n");
    stream.markdown("```\n@specky /specify Build a todo app with user accounts\n```\n");

    return { metadata: { command: "help" } };
  }

  private extractFeatureName(prompt: string): string {
    // Extract first few significant words for the feature name
    const words = prompt
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 3);

    if (words.length === 0) {
      return "new-feature";
    }

    return words.join("-").toLowerCase();
  }

  setActiveFeature(feature: Feature): void {
    this.activeFeature = feature;
  }

  dispose(): void {
    this.participant.dispose();
  }
}

interface ParsedFileChange {
  path: string;
  content: string;
}

/**
 * Specky - Chat Participant
 * Main chat participant that handles @specky commands
 */

import * as vscode from "vscode";
import { SpeckyCommand, Feature, ArtifactType } from "../types.js";
import { SpeckyFileManager } from "../services/fileManager.js";
import { ModelSelector } from "../services/modelSelector.js";
import { QualityGateService } from "../services/qualityGate.js";
import { ProgressTracker } from "../services/progressTracker.js";
import { CommandPrompts } from "./prompts.js";

const PARTICIPANT_ID = "specky.specky";

export class SpeckyChatParticipant {
  private participant: vscode.ChatParticipant;
  private activeFeature: Feature | null = null;

  constructor(
    private readonly fileManager: SpeckyFileManager,
    private readonly modelSelector: ModelSelector,
    private readonly qualityGate: QualityGateService,
    private readonly progressTracker: ProgressTracker
  ) {
    this.participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, this.handleRequest.bind(this));

    this.participant.iconPath = new vscode.ThemeIcon("checklist");
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
    const { model: targetModel, cleanPrompt } = this.modelSelector.getEffectiveModel("implement", request.prompt);

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

    // Get next task
    const nextTask = await this.progressTracker.getNextTask(this.activeFeature.id);
    if (!nextTask) {
      stream.markdown("✅ All tasks are complete! No more tasks to implement.");
      return { metadata: { command: "implement" } };
    }

    stream.markdown(`**Current task**: ${nextTask.title}\n\n`);

    // Read all artifacts
    const spec = await this.fileManager.readArtifact(this.activeFeature.id, "spec");
    const plan = await this.fileManager.readArtifact(this.activeFeature.id, "plan");
    const tasks = await this.fileManager.readArtifact(this.activeFeature.id, "tasks");

    const chatModel = await this.modelSelector.selectModel(targetModel, request.model);
    const systemPrompt = CommandPrompts.implement(
      this.activeFeature.name,
      spec || "",
      plan || "",
      tasks || "",
      nextTask.title
    );
    const userPrompt = cleanPrompt || `Implement the task: "${nextTask.title}"`;

    const messages = [
      vscode.LanguageModelChatMessage.User(systemPrompt),
      vscode.LanguageModelChatMessage.User(userPrompt),
    ];

    const response = await chatModel.sendRequest(messages, {}, token);

    for await (const chunk of response.text) {
      stream.markdown(chunk);
    }

    stream.markdown("\n\n---\n");
    stream.markdown(`After implementing, mark the task complete in \`.specky/${this.activeFeature.id}/tasks.md\``);

    return { metadata: { command: "implement" } };
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
    stream.markdown("- `/implement` - Implement tasks (after quality gates pass)\n\n");

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

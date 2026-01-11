/**
 * Specky - Tree Provider
 * Provides tree view for the Explorer panel showing features and artifacts
 */

import * as vscode from "vscode";
import { SpeckyFileManager } from "../services/fileManager.js";
import { Feature, ArtifactType } from "../types.js";

type TreeItemType = FeatureItem | ArtifactItem | ModelSettingsHeader | ModelSettingItem;

export class SpeckyTreeProvider implements vscode.TreeDataProvider<TreeItemType> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItemType | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private activeFeature: Feature | null = null;
  private configListener: vscode.Disposable;

  constructor(private readonly fileManager: SpeckyFileManager) {
    // Listen for file changes
    this.fileManager.onDidChange(() => this.refresh());

    // Listen for configuration changes to update model settings display
    this.configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("specky")) {
        this.refresh();
      }
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setActiveFeature(feature: Feature | null): void {
    this.activeFeature = feature;
    this.refresh();
  }

  getTreeItem(element: TreeItemType): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItemType): Promise<TreeItemType[]> {
    if (!element) {
      // Root level - show features and model settings section
      const featureItems = await this.getFeatureItems();
      const modelSettingsHeader = new ModelSettingsHeader();
      return [...featureItems, modelSettingsHeader];
    }

    if (element instanceof FeatureItem) {
      // Feature level - show artifacts
      return this.getArtifactItems(element.feature);
    }

    if (element instanceof ModelSettingsHeader) {
      // Model settings - show individual command model settings
      return this.getModelSettingItems();
    }

    return [];
  }

  private async getFeatureItems(): Promise<FeatureItem[]> {
    const features = await this.fileManager.listFeatures();

    return features.map((feature) => new FeatureItem(feature, feature.id === this.activeFeature?.id));
  }

  private getArtifactItems(feature: Feature): ArtifactItem[] {
    const items: ArtifactItem[] = [];

    const artifactTypes: ArtifactType[] = ["spec", "plan", "tasks"];

    for (const type of artifactTypes) {
      const artifact = feature.artifacts[type];
      items.push(new ArtifactItem(feature.id, type, artifact?.exists ?? false));
    }

    return items;
  }

  private getModelSettingItems(): ModelSettingItem[] {
    const config = vscode.workspace.getConfiguration("specky");
    const commands: { id: string; label: string; setting: string; fallback: string }[] = [
      { id: "specify", label: "Specify", setting: "specifyModel", fallback: "claude-opus-4.5" },
      { id: "plan", label: "Plan", setting: "planModel", fallback: "claude-opus-4.5" },
      { id: "tasks", label: "Tasks", setting: "tasksModel", fallback: "claude-sonnet-4.5" },
      { id: "implement", label: "Implement", setting: "implementationModel", fallback: "claude-sonnet-4.5" },
    ];

    return commands.map((cmd) => {
      const currentModel = config.get<string>(cmd.setting) || cmd.fallback;
      return new ModelSettingItem(cmd.id, cmd.label, cmd.setting, currentModel);
    });
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.configListener.dispose();
  }
}

class FeatureItem extends vscode.TreeItem {
  constructor(public readonly feature: Feature, isActive: boolean) {
    super(feature.name, vscode.TreeItemCollapsibleState.Expanded);

    this.id = feature.id;
    this.contextValue = "feature";
    this.description = this.getProgressDescription();
    this.tooltip = this.getTooltip();

    if (isActive) {
      this.iconPath = new vscode.ThemeIcon("star-full", new vscode.ThemeColor("charts.yellow"));
    } else {
      this.iconPath = new vscode.ThemeIcon("folder");
    }
  }

  private getProgressDescription(): string {
    const { totalTasks, completedTasks, percentage } = this.feature.progress;

    if (totalTasks === 0) {
      return "No tasks";
    }

    return `${completedTasks}/${totalTasks} (${percentage}%)`;
  }

  private getTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`### ${this.feature.name}\n\n`);

    // Artifacts status
    const artifacts = this.feature.artifacts;
    md.appendMarkdown("**Artifacts:**\n");
    md.appendMarkdown(`- Spec: ${artifacts.spec?.exists ? "✅" : "❌"}\n`);
    md.appendMarkdown(`- Plan: ${artifacts.plan?.exists ? "✅" : "❌"}\n`);
    md.appendMarkdown(`- Tasks: ${artifacts.tasks?.exists ? "✅" : "❌"}\n\n`);

    // Progress
    const { totalTasks, completedTasks, percentage } = this.feature.progress;
    if (totalTasks > 0) {
      md.appendMarkdown(`**Progress:** ${completedTasks}/${totalTasks} tasks (${percentage}%)\n`);
    }

    return md;
  }
}

class ArtifactItem extends vscode.TreeItem {
  constructor(public readonly featureId: string, public readonly artifactType: ArtifactType, exists: boolean) {
    const labels: Record<ArtifactType, string> = {
      spec: "Specification",
      plan: "Plan",
      tasks: "Tasks",
    };

    super(labels[artifactType], vscode.TreeItemCollapsibleState.None);

    this.contextValue = "artifact";
    this.description = exists ? "" : "(not created)";

    // Set icon based on type and existence
    if (exists) {
      const icons: Record<ArtifactType, string> = {
        spec: "file-text",
        plan: "file-code",
        tasks: "tasklist",
      };
      this.iconPath = new vscode.ThemeIcon(icons[artifactType]);
    } else {
      this.iconPath = new vscode.ThemeIcon("circle-outline");
    }

    // Command to open the file
    if (exists) {
      this.command = {
        command: "specky.openArtifact",
        title: "Open Artifact",
        arguments: [featureId, artifactType],
      };
    }
  }
}

class ModelSettingsHeader extends vscode.TreeItem {
  constructor() {
    super("Model Settings", vscode.TreeItemCollapsibleState.Collapsed);

    this.id = "model-settings-header";
    this.contextValue = "modelSettingsHeader";
    this.iconPath = new vscode.ThemeIcon("settings-gear");
    this.tooltip = "Configure which AI model to use for each command";
  }
}

class ModelSettingItem extends vscode.TreeItem {
  constructor(
    public readonly commandId: string,
    label: string,
    public readonly settingKey: string,
    currentModel: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.id = `model-setting-${commandId}`;
    this.contextValue = "modelSetting";
    this.description = this.formatModelName(currentModel);
    this.iconPath = new vscode.ThemeIcon("symbol-method");
    this.tooltip = new vscode.MarkdownString(
      `**${label} Command**\n\nCurrent model: ${this.formatModelName(currentModel)}\n\nClick to change`
    );

    // Command to change the model
    this.command = {
      command: "specky.selectModelForCommand",
      title: "Select Model",
      arguments: [commandId, label, settingKey],
    };
  }

  private formatModelName(model: string): string {
    const names: Record<string, string> = {
      "claude-opus-4.5": "Claude Opus 4.5",
      "claude-sonnet-4.5": "Claude Sonnet 4.5",
      "gpt-4o": "GPT-4o",
      "gpt-4o-mini": "GPT-4o Mini",
      o1: "o1",
      "o1-mini": "o1 Mini",
    };
    return names[model] || model;
  }
}

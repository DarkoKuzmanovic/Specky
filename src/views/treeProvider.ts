/**
 * Specky - Tree Provider
 * Provides tree view for the Explorer panel showing features and artifacts
 */

import * as vscode from "vscode";
import { SpeckyFileManager } from "../services/fileManager.js";
import { Feature, ArtifactType, ARTIFACT_FILES } from "../types.js";

type TreeItemType = FeatureItem | ArtifactItem;

export class SpeckyTreeProvider implements vscode.TreeDataProvider<TreeItemType> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItemType | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private activeFeature: Feature | null = null;

  constructor(private readonly fileManager: SpeckyFileManager) {
    // Listen for file changes
    this.fileManager.onDidChange(() => this.refresh());
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
      // Root level - show features
      return this.getFeatureItems();
    }

    if (element instanceof FeatureItem) {
      // Feature level - show artifacts
      return this.getArtifactItems(element.feature);
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

  dispose(): void {
    this._onDidChangeTreeData.dispose();
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

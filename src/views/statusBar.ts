/**
 * Specky - Status Bar
 * Shows current feature and progress in the status bar
 */

import * as vscode from "vscode";
import { SpeckyFileManager } from "../services/fileManager.js";
import { ProgressTracker } from "../services/progressTracker.js";
import { Feature } from "../types.js";

export class SpeckyStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private activeFeature: Feature | null = null;

  constructor(private readonly fileManager: SpeckyFileManager, private readonly progressTracker: ProgressTracker) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

    this.statusBarItem.command = "specky.openDashboard";
    this.statusBarItem.tooltip = "Click to open Specky Dashboard";

    // Listen for changes
    this.fileManager.onDidChange(() => this.update());
    this.progressTracker.onProgressChange(() => this.update());

    // Initial update
    this.update();
  }

  setActiveFeature(feature: Feature | null): void {
    this.activeFeature = feature;
    this.update();
  }

  async update(): Promise<void> {
    const features = await this.fileManager.listFeatures();

    if (features.length === 0) {
      this.statusBarItem.text = "$(checklist) Specky";
      this.statusBarItem.tooltip = "No features yet. Use @specky /specify to get started.";
      this.statusBarItem.show();
      return;
    }

    if (this.activeFeature) {
      // Show active feature progress
      const feature = await this.fileManager.getFeature(this.activeFeature.id);
      if (feature) {
        const { completedTasks, totalTasks, percentage } = feature.progress;

        if (totalTasks > 0) {
          this.statusBarItem.text = `$(checklist) ${feature.name}: ${completedTasks}/${totalTasks}`;
          this.statusBarItem.tooltip = new vscode.MarkdownString(
            `**${feature.name}**\n\n` +
              `Progress: ${percentage}%\n\n` +
              `Tasks: ${completedTasks}/${totalTasks}\n\n` +
              `Click to open dashboard`
          );
        } else {
          this.statusBarItem.text = `$(checklist) ${feature.name}`;
          this.statusBarItem.tooltip = `Active feature: ${feature.name}\n\nClick to open dashboard`;
        }
      }
    } else {
      // Show overall progress
      const progress = await this.progressTracker.getOverallProgress();
      this.statusBarItem.text = `$(checklist) Specky: ${progress.totalFeatures} features`;
      this.statusBarItem.tooltip = new vscode.MarkdownString(
        `**Specky**\n\n` +
          `Features: ${progress.totalFeatures}\n` +
          `Tasks: ${progress.completedTasks}/${progress.totalTasks} (${progress.percentage}%)\n\n` +
          `Click to open dashboard`
      );
    }

    this.statusBarItem.show();
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}

/**
 * Specky - Progress Tracker
 * Tracks and persists task completion progress
 */

import * as vscode from "vscode";
import { SpeckyFileManager } from "./fileManager.js";
import { Feature, Task } from "../types.js";

export class ProgressTracker {
  private _onProgressChange = new vscode.EventEmitter<Feature>();
  readonly onProgressChange = this._onProgressChange.event;

  constructor(private readonly fileManager: SpeckyFileManager) {
    // Listen to file changes and recalculate progress
    this.fileManager.onDidChange(() => this.notifyProgressChange());
  }

  private async notifyProgressChange(): Promise<void> {
    const features = await this.fileManager.listFeatures();
    for (const feature of features) {
      this._onProgressChange.fire(feature);
    }
  }

  /**
   * Toggle a task's completion status
   */
  async toggleTask(featureId: string, taskId: string): Promise<void> {
    await this.fileManager.toggleTask(featureId, taskId);
  }

  /**
   * Get all tasks for a feature
   */
  async getTasks(featureId: string): Promise<Task[]> {
    const feature = await this.fileManager.getFeature(featureId);
    if (!feature?.artifacts.tasks?.exists) {
      return [];
    }

    const tasksUri = this.fileManager.getArtifactUri(featureId, "tasks");
    return this.fileManager.parseTasks(tasksUri);
  }

  /**
   * Get progress summary for all features
   */
  async getOverallProgress(): Promise<{
    totalFeatures: number;
    totalTasks: number;
    completedTasks: number;
    percentage: number;
  }> {
    const features = await this.fileManager.listFeatures();

    let totalTasks = 0;
    let completedTasks = 0;

    for (const feature of features) {
      totalTasks += feature.progress.totalTasks;
      completedTasks += feature.progress.completedTasks;
    }

    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalFeatures: features.length,
      totalTasks,
      completedTasks,
      percentage,
    };
  }

  /**
   * Format progress for display
   */
  formatProgress(feature: Feature): string {
    const { totalTasks, completedTasks, percentage } = feature.progress;

    if (totalTasks === 0) {
      return "No tasks defined";
    }

    const bar = this.createProgressBar(percentage);
    return `${bar} ${completedTasks}/${totalTasks} (${percentage}%)`;
  }

  /**
   * Create ASCII progress bar
   */
  private createProgressBar(percentage: number, width: number = 10): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
  }

  /**
   * Get next incomplete task
   */
  async getNextTask(featureId: string): Promise<Task | null> {
    const tasks = await this.getTasks(featureId);
    return this.findFirstIncomplete(tasks);
  }

  private findFirstIncomplete(tasks: Task[]): Task | null {
    for (const task of tasks) {
      if (!task.completed) {
        return task;
      }
      if (task.subtasks) {
        const incomplete = this.findFirstIncomplete(task.subtasks);
        if (incomplete) {
          return incomplete;
        }
      }
    }
    return null;
  }

  dispose(): void {
    this._onProgressChange.dispose();
  }
}

/**
 * Specky - File Manager Service
 * Handles all file operations for .specky directory and artifacts
 */

import * as vscode from "vscode";
import { Feature, FeatureArtifact, FeatureProgress, ArtifactType, ARTIFACT_FILES, Task } from "../types.js";

export class SpeckyFileManager {
  private static readonly SPECKY_DIR = ".specky";
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private fileWatcher: vscode.FileSystemWatcher | undefined;

  constructor(private readonly workspaceRoot: vscode.Uri) {
    this.setupFileWatcher();
  }

  private setupFileWatcher(): void {
    const pattern = new vscode.RelativePattern(this.workspaceRoot, `${SpeckyFileManager.SPECKY_DIR}/**/*.md`);
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.fileWatcher.onDidCreate(() => this._onDidChange.fire());
    this.fileWatcher.onDidChange(() => this._onDidChange.fire());
    this.fileWatcher.onDidDelete(() => this._onDidChange.fire());
  }

  /**
   * Get the .specky directory URI
   */
  get speckyDir(): vscode.Uri {
    return vscode.Uri.joinPath(this.workspaceRoot, SpeckyFileManager.SPECKY_DIR);
  }

  /**
   * Ensure .specky directory exists
   */
  async ensureSpeckyDir(): Promise<void> {
    try {
      await vscode.workspace.fs.stat(this.speckyDir);
    } catch {
      await vscode.workspace.fs.createDirectory(this.speckyDir);
    }
  }

  /**
   * Check if .specky directory exists
   */
  async speckyDirExists(): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.speckyDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all features in .specky directory
   */
  async listFeatures(): Promise<Feature[]> {
    try {
      // Don't create .specky folder if it doesn't exist - just return empty list
      if (!(await this.speckyDirExists())) {
        return [];
      }
      const entries = await vscode.workspace.fs.readDirectory(this.speckyDir);

      const features: Feature[] = [];

      for (const [name, type] of entries) {
        if (type !== vscode.FileType.Directory) {
          continue;
        }

        const parsed = this.parseFeatureDir(name);
        if (!parsed) {
          continue;
        }

        const featurePath = vscode.Uri.joinPath(this.speckyDir, name);
        const artifacts = await this.loadArtifacts(featurePath);
        const progress = await this.calculateProgress(artifacts.tasks);

        features.push({
          id: name,
          number: parsed.number,
          name: parsed.name,
          path: featurePath.fsPath,
          artifacts,
          progress,
        });
      }

      // Sort by number
      features.sort((a, b) => a.number - b.number);

      return features;
    } catch {
      return [];
    }
  }

  /**
   * Parse feature directory name (e.g., "001-user-auth")
   */
  private parseFeatureDir(name: string): { number: number; name: string } | null {
    const match = name.match(/^(\d{3})-(.+)$/);
    if (!match) {
      return null;
    }
    return {
      number: parseInt(match[1], 10),
      name: match[2],
    };
  }

  /**
   * Load all artifacts for a feature
   */
  private async loadArtifacts(featurePath: vscode.Uri): Promise<Feature["artifacts"]> {
    const artifacts: Feature["artifacts"] = {};

    for (const [type, filename] of Object.entries(ARTIFACT_FILES) as [ArtifactType, string][]) {
      const artifactPath = vscode.Uri.joinPath(featurePath, filename);
      artifacts[type] = await this.loadArtifact(type, artifactPath);
    }

    return artifacts;
  }

  /**
   * Load a single artifact
   */
  private async loadArtifact(type: ArtifactType, artifactPath: vscode.Uri): Promise<FeatureArtifact> {
    try {
      const stat = await vscode.workspace.fs.stat(artifactPath);
      return {
        type,
        path: artifactPath.fsPath,
        exists: true,
        lastModified: stat.mtime,
      };
    } catch {
      return {
        type,
        path: artifactPath.fsPath,
        exists: false,
      };
    }
  }

  /**
   * Calculate progress from tasks file
   */
  private async calculateProgress(tasksArtifact?: FeatureArtifact): Promise<FeatureProgress> {
    if (!tasksArtifact?.exists) {
      return { totalTasks: 0, completedTasks: 0, percentage: 0 };
    }

    try {
      const tasks = await this.parseTasks(vscode.Uri.file(tasksArtifact.path));
      const total = this.countTasks(tasks);
      const completed = this.countCompletedTasks(tasks);
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return { totalTasks: total, completedTasks: completed, percentage };
    } catch {
      return { totalTasks: 0, completedTasks: 0, percentage: 0 };
    }
  }

  /**
   * Parse tasks from markdown file
   */
  async parseTasks(tasksPath: vscode.Uri): Promise<Task[]> {
    try {
      const content = await this.readFile(tasksPath);
      return this.parseTasksFromContent(content);
    } catch {
      return [];
    }
  }

  /**
   * Parse task checkboxes from markdown content
   * L-3: Implements proper task nesting with indentation stack
   */
  parseTasksFromContent(content: string): Task[] {
    const tasks: Task[] = [];
    const lines = content.split("\n");
    let taskId = 0;

    // Stack to track parent tasks at each indentation level
    // Index represents indent level (0, 2, 4, etc. / 2)
    const parentStack: (Task | null)[] = [null];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(\s*)- \[([ xX])\] (.+)$/);

      if (match) {
        const indent = match[1].length;
        const indentLevel = Math.floor(indent / 2); // Normalize: 0 spaces = level 0, 2 spaces = level 1, etc.
        const completed = match[2].toLowerCase() === "x";
        const title = match[3].trim();

        const task: Task = {
          id: `task-${taskId++}`,
          title,
          completed,
          lineNumber: i + 1,
        };

        if (indentLevel === 0) {
          // Top-level task
          tasks.push(task);
          // Reset stack and set this as the parent at level 0
          parentStack.length = 1;
          parentStack[0] = task;
        } else {
          // Nested task - find the correct parent
          // The parent is at level (indentLevel - 1)
          const parentLevel = indentLevel - 1;
          const parent = parentStack[parentLevel];

          if (parent) {
            parent.subtasks = parent.subtasks || [];
            parent.subtasks.push(task);
          } else {
            // No parent found at expected level, attach to last known parent or root
            // This handles cases where indentation jumps unexpectedly
            for (let level = parentLevel - 1; level >= 0; level--) {
              if (parentStack[level]) {
                parentStack[level]!.subtasks = parentStack[level]!.subtasks || [];
                parentStack[level]!.subtasks!.push(task);
                break;
              }
            }
            // If still no parent found, add to root
            if (!parentStack.slice(0, parentLevel).some((p) => p !== null)) {
              tasks.push(task);
            }
          }

          // Update stack: set this task as potential parent for next level
          parentStack[indentLevel] = task;
          // Clear any deeper levels
          parentStack.length = indentLevel + 1;
        }
      }
    }

    return tasks;
  }

  private countTasks(tasks: Task[]): number {
    let count = tasks.length;
    for (const task of tasks) {
      if (task.subtasks) {
        count += this.countTasks(task.subtasks);
      }
    }
    return count;
  }

  private countCompletedTasks(tasks: Task[]): number {
    let count = tasks.filter((t) => t.completed).length;
    for (const task of tasks) {
      if (task.subtasks) {
        count += this.countCompletedTasks(task.subtasks);
      }
    }
    return count;
  }

  /**
   * Get the next feature number
   */
  async getNextFeatureNumber(): Promise<number> {
    const features = await this.listFeatures();
    if (features.length === 0) {
      return 1;
    }
    return Math.max(...features.map((f) => f.number)) + 1;
  }

  /**
   * Create a new feature directory
   */
  async createFeature(name: string): Promise<Feature> {
    await this.ensureSpeckyDir();

    const number = await this.getNextFeatureNumber();
    // M-3: Validate slug output and fallback to "new-feature" if empty
    let slug = this.slugify(name);
    if (!slug) {
      slug = "new-feature";
    }
    const dirName = `${number.toString().padStart(3, "0")}-${slug}`;
    const featurePath = vscode.Uri.joinPath(this.speckyDir, dirName);

    await vscode.workspace.fs.createDirectory(featurePath);

    this._onDidChange.fire();

    return {
      id: dirName,
      number,
      name: slug,
      path: featurePath.fsPath,
      artifacts: {},
      progress: { totalTasks: 0, completedTasks: 0, percentage: 0 },
    };
  }

  /**
   * Convert name to slug
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /**
   * Get feature by ID
   */
  async getFeature(featureId: string): Promise<Feature | undefined> {
    const features = await this.listFeatures();
    return features.find((f) => f.id === featureId);
  }

  /**
   * Read file content
   */
  async readFile(uri: vscode.Uri): Promise<string> {
    const content = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(content).toString("utf-8");
  }

  /**
   * Write file content
   */
  async writeFile(uri: vscode.Uri, content: string): Promise<void> {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
    this._onDidChange.fire();
  }

  /**
   * Write artifact content
   */
  async writeArtifact(featureId: string, type: ArtifactType, content: string): Promise<void> {
    const featurePath = vscode.Uri.joinPath(this.speckyDir, featureId);
    const artifactPath = vscode.Uri.joinPath(featurePath, ARTIFACT_FILES[type]);

    await vscode.workspace.fs.createDirectory(featurePath);
    await this.writeFile(artifactPath, content);
  }

  /**
   * Read artifact content
   */
  async readArtifact(featureId: string, type: ArtifactType): Promise<string | null> {
    try {
      const featurePath = vscode.Uri.joinPath(this.speckyDir, featureId);
      const artifactPath = vscode.Uri.joinPath(featurePath, ARTIFACT_FILES[type]);
      return await this.readFile(artifactPath);
    } catch {
      return null;
    }
  }

  /**
   * Toggle task completion in tasks.md
   */
  async toggleTask(featureId: string, taskId: string): Promise<void> {
    const content = await this.readArtifact(featureId, "tasks");
    if (!content) {
      return;
    }

    const tasks = this.parseTasksFromContent(content);
    const task = this.findTask(tasks, taskId);

    if (!task) {
      return;
    }

    const lines = content.split("\n");
    const line = lines[task.lineNumber - 1];

    if (task.completed) {
      lines[task.lineNumber - 1] = line.replace(/\[x\]/i, "[ ]");
    } else {
      lines[task.lineNumber - 1] = line.replace(/\[ \]/, "[x]");
    }

    await this.writeArtifact(featureId, "tasks", lines.join("\n"));
  }

  private findTask(tasks: Task[], taskId: string): Task | undefined {
    for (const task of tasks) {
      if (task.id === taskId) {
        return task;
      }
      if (task.subtasks) {
        const found = this.findTask(task.subtasks, taskId);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  /**
   * Get artifact URI
   */
  getArtifactUri(featureId: string, type: ArtifactType): vscode.Uri {
    return vscode.Uri.joinPath(this.speckyDir, featureId, ARTIFACT_FILES[type]);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.fileWatcher?.dispose();
    this._onDidChange.dispose();
  }
}

/**
 * Specky - Dashboard Webview
 * Visual dashboard for managing features and viewing progress
 */

import * as vscode from "vscode";
import { SpeckyFileManager } from "../services/fileManager.js";
import { ProgressTracker } from "../services/progressTracker.js";
import { DashboardState, WebviewMessage, Feature } from "../types.js";

export class SpeckyDashboard {
  public static currentPanel: SpeckyDashboard | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private activeFeature: Feature | null = null;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly fileManager: SpeckyFileManager,
    private readonly progressTracker: ProgressTracker
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    // Set initial HTML
    this.panel.webview.html = this.getHtmlContent();

    // Listen for messages from webview
    this.panel.webview.onDidReceiveMessage((message) => this.handleMessage(message), null, this.disposables);

    // Listen for file changes
    this.fileManager.onDidChange(() => this.sendStateUpdate());

    // Handle panel disposal
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Initial state update
    this.sendStateUpdate();
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    fileManager: SpeckyFileManager,
    progressTracker: ProgressTracker
  ): SpeckyDashboard {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    // If panel exists, show it
    if (SpeckyDashboard.currentPanel) {
      SpeckyDashboard.currentPanel.panel.reveal(column);
      return SpeckyDashboard.currentPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      "speckyDashboard",
      "Specky Dashboard",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    SpeckyDashboard.currentPanel = new SpeckyDashboard(panel, extensionUri, fileManager, progressTracker);

    return SpeckyDashboard.currentPanel;
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        await this.sendStateUpdate();
        break;

      case "refreshRequest":
        await this.sendStateUpdate();
        break;

      case "selectFeature": {
        const feature = await this.fileManager.getFeature(message.featureId);
        if (feature) {
          this.activeFeature = feature;
          await this.sendStateUpdate();
        }
        break;
      }

      case "toggleTask":
        await this.progressTracker.toggleTask(message.featureId, message.taskId);
        await this.sendStateUpdate();
        break;

      case "openArtifact": {
        const uri = this.fileManager.getArtifactUri(message.featureId, message.artifactType);
        await vscode.window.showTextDocument(uri);
        break;
      }

      case "runCommand":
        await vscode.commands.executeCommand("workbench.action.chat.open", { query: `@specky /${message.command}` });
        break;
    }
  }

  private async sendStateUpdate(): Promise<void> {
    const features = await this.fileManager.listFeatures();

    // Update active feature if it no longer exists
    if (this.activeFeature) {
      const stillExists = features.find((f) => f.id === this.activeFeature?.id);
      if (!stillExists) {
        this.activeFeature = null;
      }
    }

    const state: DashboardState = {
      features,
      activeFeature: this.activeFeature,
      loading: false,
    };

    this.panel.webview.postMessage({
      type: "stateUpdate",
      state,
    });
  }

  setActiveFeature(feature: Feature): void {
    this.activeFeature = feature;
    this.sendStateUpdate();
  }

  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Specky Dashboard</title>
    <style>
        :root {
            --vscode-font-family: var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
            --border-radius: 4px;
            --card-padding: 16px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 24px;
            line-height: 1.6;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
        }

        .header-title {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .header h1 {
            font-size: 22px;
            font-weight: 500;
        }

        .header-actions {
            display: flex;
            gap: 12px;
        }

        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid transparent;
            padding: 6px 14px;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background 0.1s ease;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .layout {
            display: grid;
            grid-template-columns: 320px 1fr;
            gap: 32px;
            max-width: 1400px;
            margin: 0 auto;
        }

        .sidebar {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .sidebar h2 {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }

        .feature-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .feature-card {
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: var(--border-radius);
            padding: 16px;
            cursor: pointer;
            transition: border-color 0.2s, background 0.2s;
        }

        .feature-card:hover {
            border-color: var(--vscode-focusBorder);
        }

        .feature-card.active {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .feature-card.active .feature-number,
        .feature-card.active .progress-text {
            color: inherit;
            opacity: 0.8;
        }

        .feature-info {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
        }

        .feature-name {
            font-weight: 600;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .feature-number {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            font-family: var(--vscode-editor-font-family, monospace);
        }

        .main-content {
            min-width: 0;
        }

        .detail-view {
            display: flex;
            flex-direction: column;
            gap: 32px;
        }

        .card {
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: var(--border-radius);
            padding: 24px;
        }

        .card-header {
            margin-bottom: 20px;
        }

        .card-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .card-subtitle {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }

        .artifacts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
        }

        .artifact-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: var(--border-radius);
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .artifact-card:hover {
            border-color: var(--vscode-focusBorder);
            transform: translateY(-2px);
        }

        .artifact-card.exists {
            border-top: 3px solid var(--vscode-charts-green);
        }

        .artifact-card.missing {
            opacity: 0.7;
            border-top: 3px solid var(--vscode-descriptionForeground);
        }

        .artifact-icon {
            font-size: 32px;
        }

        .artifact-name {
            font-weight: 600;
            font-size: 14px;
        }

        .artifact-status {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .progress-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .progress-bar {
            height: 8px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: var(--vscode-progressBar-background);
            transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .progress-fill.complete {
            background: var(--vscode-charts-green);
        }

        .actions-group {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 400px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            background: var(--vscode-sideBar-background);
            border: 2px dashed var(--vscode-panel-border);
            border-radius: 12px;
        }

        .empty-icon {
            font-size: 64px;
            margin-bottom: 24px;
            opacity: 0.3;
        }

        .next-steps {
            background: var(--vscode-infoViews-background, var(--vscode-sideBar-background));
            border-left: 4px solid var(--vscode-infoForeground);
            padding: 16px;
            border-radius: var(--border-radius);
            margin-top: 16px;
        }

        .next-steps h4 {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
            animation: fadeIn 0.3s ease-out forwards;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-title">
            <h1>Specky Dashboard</h1>
        </div>
        <div class="header-actions">
            <button onclick="refresh()" class="secondary">Refresh</button>
            <button onclick="runCommand('specify')">New Feature</button>
        </div>
    </div>

    <div class="layout">
        <div class="sidebar">
            <h2>Features</h2>
            <div id="feature-list" class="feature-list">
                <!-- Features populated by JS -->
            </div>
        </div>

        <div class="main-content" id="main-content">
            <!-- Main content populated by JS -->
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentState = { features: [], activeFeature: null, loading: true };

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'stateUpdate') {
                currentState = message.state;
                render();
            }
        });

        vscode.postMessage({ type: 'ready' });

        function render() {
            renderFeatureList();
            renderMainContent();
        }

        function renderFeatureList() {
            const container = document.getElementById('feature-list');

            if (currentState.features.length === 0) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--vscode-descriptionForeground);">No features yet. Create one to get started.</div>';
                return;
            }

            container.innerHTML = currentState.features.map(feature => {
                const isActive = currentState.activeFeature?.id === feature.id;
                const { totalTasks, completedTasks, percentage } = feature.progress;

                return \`
                    <div class="feature-card \${isActive ? 'active' : ''}" onclick="selectFeature('\${feature.id}')">
                        <div class="feature-info">
                            <div class="feature-name" title="\${feature.name}">\${feature.name}</div>
                            <div class="feature-number">#\${feature.number.toString().padStart(3, '0')}</div>
                        </div>
                        \${totalTasks > 0 ? \`
                            <div class="progress-bar">
                                <div class="progress-fill \${percentage === 100 ? 'complete' : ''}" style="width: \${percentage}%"></div>
                            </div>
                            <div class="progress-text" style="font-size: 11px; margin-top: 6px; opacity: 0.8;">\${completedTasks}/\${totalTasks} tasks (\${percentage}%)</div>
                        \` : '<div class="progress-text" style="font-size: 11px; margin-top: 6px; opacity: 0.6;">No tasks yet</div>'}
                    </div>
                \`;
            }).join('');
        }

        function renderMainContent() {
            const container = document.getElementById('main-content');
            const feature = currentState.activeFeature;

            if (!feature) {
                container.innerHTML = \`
                    <div class="empty-state animate-fade-in">
                        <div class="empty-icon">📂</div>
                        <h3>No Feature Selected</h3>
                        <p style="margin: 8px 0 24px 0">Select a feature from the sidebar to view details and progress.</p>
                        <button onclick="runCommand('specify')">Create First Specification</button>
                    </div>
                \`;
                return;
            }

            const artifacts = [
                { type: 'spec', name: 'Specification', icon: '📄', exists: feature.artifacts.spec?.exists },
                { type: 'plan', name: 'Plan', icon: '🏗️', exists: feature.artifacts.plan?.exists },
                { type: 'tasks', name: 'Tasks', icon: '📋', exists: feature.artifacts.tasks?.exists }
            ];

            const nextStep = getNextStep(feature);

            container.innerHTML = \`
                <div class="detail-view animate-fade-in">
                    <div class="card">
                        <div class="card-header">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <div class="card-title">\${feature.name}</div>
                                    <div class="card-subtitle">ID: \${feature.id}</div>
                                </div>
                                <div class="feature-number" style="font-size: 16px;">#\${feature.number.toString().padStart(3, '0')}</div>
                            </div>
                        </div>

                        <div class="artifacts-grid">
                            \${artifacts.map(a => \`
                                <div class="artifact-card \${a.exists ? 'exists' : 'missing'}"
                                     onclick="\${a.exists ? \`openArtifact('\${feature.id}', '\${a.type}')\` : \`runCommand('\${a.type === 'spec' ? 'specify' : a.type === 'plan' ? 'plan' : 'tasks'}')\`}">
                                    <div class="artifact-icon">\${a.icon}</div>
                                    <div class="artifact-name">\${a.name}</div>
                                    <div class="artifact-status">\${a.exists ? '✓ Created' : '○ Pending'}</div>
                                </div>
                            \`).join('')}
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Implementation Progress</div>
                        </div>
                        <div class="progress-section">
                            <div class="progress-header">
                                <span style="font-size: 14px; font-weight: 500;">Overall Completion</span>
                                <span style="font-size: 14px; color: var(--vscode-descriptionForeground);">\${feature.progress.completedTasks} / \${feature.progress.totalTasks} Tasks</span>
                            </div>
                            <div class="progress-bar" style="height: 12px;">
                                <div class="progress-fill \${feature.progress.percentage === 100 ? 'complete' : ''}" style="width: \${feature.progress.percentage}%"></div>
                            </div>

                            \${nextStep ? \`
                                <div class="next-steps">
                                    <h4>💡 Recommended Next Step</h4>
                                    <p style="font-size: 13px;">\${nextStep.text}</p>
                                    <button style="margin-top: 12px;" onclick="runCommand('\${nextStep.command}')">\${nextStep.buttonText}</button>
                                </div>
                            \` : ''}
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Quick Actions</div>
                        </div>
                        <div class="actions-group">
                            <button class="secondary" onclick="runCommand('specify')">Refine Spec</button>
                            <button class="secondary" onclick="runCommand('clarify')">Clarify Spec</button>
                            <button class="secondary" onclick="runCommand('plan')">Update Plan</button>
                            <button class="secondary" onclick="runCommand('tasks')">Update Tasks</button>
                            <button onclick="runCommand('implement')">🚀 Implement Next Task</button>
                        </div>
                    </div>
                </div>
            \`;
        }

        function getNextStep(feature) {
            if (!feature.artifacts.spec?.exists) {
                return { text: "Start by generating a specification for this feature.", command: "specify", buttonText: "Generate Spec" };
            }
            if (!feature.artifacts.plan?.exists) {
                return { text: "Specification is ready! Now create a technical implementation plan.", command: "plan", buttonText: "Create Plan" };
            }
            if (!feature.artifacts.tasks?.exists) {
                return { text: "Plan is defined. Break it down into implementable tasks.", command: "tasks", buttonText: "Break Down Tasks" };
            }
            if (feature.progress.percentage < 100) {
                return { text: "Everything is set! Start implementing the tasks.", command: "implement", buttonText: "Continue Implementation" };
            }
            return null;
        }

        function selectFeature(featureId) {
            vscode.postMessage({ type: 'selectFeature', featureId });
        }

        function openArtifact(featureId, artifactType) {
            vscode.postMessage({ type: 'openArtifact', featureId, artifactType });
        }

        function runCommand(command) {
            vscode.postMessage({
                type: 'runCommand',
                command,
                featureId: currentState.activeFeature?.id
            });
        }

        function refresh() {
            vscode.postMessage({ type: 'refreshRequest' });
        }

        render();
    </script>
</body>
</html>`;
  }

  private dispose(): void {
    SpeckyDashboard.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }
}

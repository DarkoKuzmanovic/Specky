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
        // M-1: Validate featureId against known features
        const features = await this.fileManager.listFeatures();
        const feature = features.find((f) => f.id === message.featureId);
        if (feature) {
          this.activeFeature = feature;
          // M-2: Sync selection with extension state (tree view, status bar, chat participant)
          await vscode.commands.executeCommand("specky.setActiveFeature", feature.id);
          await this.sendStateUpdate();
        }
        break;
      }

      case "toggleTask":
        await this.progressTracker.toggleTask(message.featureId, message.taskId);
        await this.sendStateUpdate();
        break;

      case "openArtifact": {
        // M-1: Validate featureId against known features before opening artifacts
        const knownFeatures = await this.fileManager.listFeatures();
        const validFeature = knownFeatures.find((f) => f.id === message.featureId);
        if (!validFeature) {
          vscode.window.showWarningMessage(`Unknown feature: ${message.featureId}`);
          return;
        }
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

    // L-1: Update activeFeature from refreshed features list to avoid stale data
    if (this.activeFeature) {
      const updatedFeature = features.find((f) => f.id === this.activeFeature?.id);
      if (updatedFeature) {
        // Replace with fresh data from the updated list
        this.activeFeature = updatedFeature;
      } else {
        // Feature no longer exists
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

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private getHtmlContent(): string {
    // Generate a nonce for CSP
    const nonce = this.getNonce();

    // Get codicon CSS URI
    const codiconsUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; font-src ${this.panel.webview.cspSource}; script-src 'nonce-${nonce}';">
    <title>Specky Dashboard</title>
    <link href="${codiconsUri}" rel="stylesheet" />
    <style>
        :root {
            /* 4px Spacing Grid */
            --s1: 4px;
            --s2: 8px;
            --s3: 12px;
            --s4: 16px;
            --s5: 20px;
            --s6: 24px;
            --s8: 32px;

            /* Border Radius */
            --radius-sharp: 4px;
            --radius-soft: 8px;

            /* Contrast Hierarchy */
            --color-fg: var(--vscode-editor-foreground);
            --color-secondary: var(--vscode-descriptionForeground);
            --color-muted: color-mix(in srgb, var(--vscode-editor-foreground), transparent 60%);
            --color-faint: var(--vscode-panel-border);

            /* Animation */
            --anim-micro: 150ms var(--ease);
            --anim-standard: 250ms var(--ease);
            --ease: cubic-bezier(0.25, 1, 0.5, 1);

            --vscode-font-family: var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--color-fg);
            padding: var(--s6);
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--s8);
        }

        .header-title {
            display: flex;
            align-items: center;
            gap: var(--s3);
        }

        .header h1 {
            font-size: 20px;
            font-weight: 600;
            letter-spacing: -0.01em;
        }

        .header-actions {
            display: flex;
            gap: var(--s3);
        }

        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid transparent;
            padding: var(--s1) var(--s3);
            border-radius: var(--radius-sharp);
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: var(--s2);
            transition: background var(--anim-micro);
            height: 32px;
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

        i {
            font-size: 16px;
        }

        .layout {
            display: grid;
            grid-template-columns: 300px 1fr;
            gap: var(--s8);
            max-width: 1400px;
            margin: 0 auto;
        }

        .sidebar {
            display: flex;
            flex-direction: column;
            gap: var(--s4);
        }

        .sidebar h2 {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--color-secondary);
            margin-bottom: var(--s2);
        }

        .feature-list {
            display: flex;
            flex-direction: column;
            gap: var(--s2);
        }

        .feature-card {
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--color-faint);
            border-radius: var(--radius-sharp);
            padding: var(--s4);
            cursor: pointer;
            transition: border-color var(--anim-micro), background var(--anim-micro);
        }

        .feature-card:hover {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-hoverBackground);
        }

        .feature-card.active {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .feature-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--s3);
        }

        .feature-name {
            font-weight: 600;
            font-size: 13px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .feature-number {
            color: var(--color-secondary);
            font-size: 11px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-variant-numeric: tabular-nums;
            opacity: 0.7;
        }

        .feature-card.active .feature-number {
            color: inherit;
            opacity: 0.8;
        }

        .feature-progress-mini {
            display: flex;
            align-items: center;
            gap: var(--s2);
        }

        .progress-bar-mini {
            flex: 1;
            height: 4px;
            background: var(--vscode-editor-background);
            border-radius: 2px;
            overflow: hidden;
        }

        .progress-fill-mini {
            height: 100%;
            background: var(--vscode-progressBar-background);
            transition: width var(--anim-standard);
        }

        .progress-text-mini {
            font-size: 10px;
            font-weight: 500;
            font-variant-numeric: tabular-nums;
            color: var(--color-secondary);
            min-width: 30px;
            text-align: right;
        }

        .feature-card.active .progress-text-mini {
            color: inherit;
        }

        .main-content {
            min-width: 0;
        }

        .detail-view {
            display: flex;
            flex-direction: column;
            gap: var(--s6);
        }

        .card {
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--color-faint);
            border-radius: var(--radius-sharp);
            padding: var(--s6);
        }

        .card-header {
            margin-bottom: var(--s5);
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .card-title-group {
            display: flex;
            flex-direction: column;
            gap: var(--s1);
        }

        .card-title {
            font-size: 18px;
            font-weight: 600;
            letter-spacing: -0.01em;
        }

        .card-subtitle {
            color: var(--color-secondary);
            font-size: 12px;
            font-family: var(--vscode-editor-font-family, monospace);
        }

        .artifacts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: var(--s3);
        }

        .artifact-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--color-faint);
            border-radius: var(--radius-sharp);
            padding: var(--s4);
            display: flex;
            flex-direction: column;
            gap: var(--s3);
            cursor: pointer;
            transition: border-color var(--anim-micro);
            position: relative;
        }

        .artifact-card:hover {
            border-color: var(--vscode-focusBorder);
        }

        .artifact-card-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .artifact-icon-box {
            width: 32px;
            height: 32px;
            border-radius: var(--radius-sharp);
            background: var(--vscode-sideBar-background);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--color-faint);
        }

        .artifact-icon-box i {
            font-size: 18px;
            color: var(--color-secondary);
        }

        .artifact-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--color-muted);
        }

        .artifact-card.exists .artifact-status-dot {
            background: var(--vscode-charts-green);
        }

        .artifact-name {
            font-weight: 600;
            font-size: 13px;
        }

        .artifact-status-text {
            font-size: 11px;
            color: var(--color-secondary);
            font-weight: 500;
        }

        .progress-section {
            display: flex;
            flex-direction: column;
            gap: var(--s4);
        }

        .progress-label-group {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
        }

        .progress-label {
            font-size: 13px;
            font-weight: 600;
        }

        .progress-value {
            font-size: 12px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-variant-numeric: tabular-nums;
            color: var(--color-secondary);
        }

        .progress-bar-large {
            height: 8px;
            background: var(--vscode-editor-background);
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid var(--color-faint);
        }

        .progress-fill-large {
            height: 100%;
            background: var(--vscode-progressBar-background);
            transition: width var(--anim-standard);
        }

        .progress-fill-large.complete {
            background: var(--vscode-charts-green);
        }

        .next-step-card {
            background: color-mix(in srgb, var(--vscode-infoForeground), transparent 92%);
            border: 1px solid color-mix(in srgb, var(--vscode-infoForeground), transparent 80%);
            padding: var(--s4);
            border-radius: var(--radius-sharp);
            display: flex;
            gap: var(--s3);
            align-items: flex-start;
        }

        .next-step-icon {
            color: var(--vscode-infoForeground);
            font-size: 20px;
            margin-top: 2px;
        }

        .next-step-content {
            flex: 1;
        }

        .next-step-title {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: var(--s1);
            color: var(--vscode-infoForeground);
        }

        .next-step-desc {
            font-size: 12px;
            color: var(--color-fg);
            opacity: 0.9;
            margin-bottom: var(--s3);
        }

        .actions-group {
            display: flex;
            flex-wrap: wrap;
            gap: var(--s2);
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 400px;
            text-align: center;
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--color-faint);
            border-radius: var(--radius-sharp);
            padding: var(--s8);
        }

        .empty-icon-box {
            width: 64px;
            height: 64px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--color-faint);
            border-radius: var(--radius-soft);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: var(--s6);
        }

        .empty-icon-box i {
            font-size: 32px;
            color: var(--color-muted);
        }

        .empty-state h3 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: var(--s2);
        }

        .empty-state p {
            color: var(--color-secondary);
            font-size: 13px;
            margin-bottom: var(--s6);
            max-width: 300px;
        }

        /* Tabs */
        .tabs {
            display: flex;
            gap: var(--s1);
            margin-bottom: var(--s6);
            border-bottom: 1px solid var(--color-faint);
            padding-bottom: var(--s1);
        }

        .tab {
            background: transparent;
            border: none;
            color: var(--color-secondary);
            padding: var(--s2) var(--s4);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border-radius: var(--radius-sharp) var(--radius-sharp) 0 0;
            transition: color var(--anim-micro), background var(--anim-micro);
            height: auto;
        }

        .tab:hover {
            color: var(--color-fg);
            background: var(--vscode-list-hoverBackground);
        }

        .tab.active {
            color: var(--color-fg);
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--color-faint);
            border-bottom-color: var(--vscode-sideBar-background);
            margin-bottom: -1px;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        /* Guide Styles */
        .guide-section {
            margin-bottom: var(--s6);
        }

        .guide-section:last-child {
            margin-bottom: 0;
        }

        .guide-section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: var(--s3);
            display: flex;
            align-items: center;
            gap: var(--s2);
        }

        .guide-section-title i {
            color: var(--vscode-infoForeground);
        }

        .workflow-steps {
            display: flex;
            flex-direction: column;
            gap: var(--s3);
        }

        .workflow-step {
            display: flex;
            gap: var(--s3);
            padding: var(--s4);
            background: var(--vscode-editor-background);
            border: 1px solid var(--color-faint);
            border-radius: var(--radius-sharp);
        }

        .step-number {
            width: 24px;
            height: 24px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            flex-shrink: 0;
        }

        .step-content {
            flex: 1;
        }

        .step-title {
            font-weight: 600;
            font-size: 13px;
            margin-bottom: var(--s1);
        }

        .step-desc {
            font-size: 12px;
            color: var(--color-secondary);
            line-height: 1.5;
        }

        .command-tag {
            display: inline-flex;
            align-items: center;
            gap: var(--s1);
            background: var(--vscode-textCodeBlock-background);
            padding: 2px var(--s2);
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 11px;
            color: var(--vscode-textPreformat-foreground);
        }

        .tips-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: var(--s3);
        }

        .tip-card {
            padding: var(--s4);
            background: var(--vscode-editor-background);
            border: 1px solid var(--color-faint);
            border-radius: var(--radius-sharp);
        }

        .tip-header {
            display: flex;
            align-items: center;
            gap: var(--s2);
            margin-bottom: var(--s2);
        }

        .tip-header i {
            color: var(--vscode-charts-yellow);
            font-size: 18px;
        }

        .tip-title {
            font-weight: 600;
            font-size: 13px;
        }

        .tip-desc {
            font-size: 12px;
            color: var(--color-secondary);
            line-height: 1.5;
        }

        .commands-list {
            display: flex;
            flex-direction: column;
            gap: var(--s2);
        }

        .command-row {
            display: flex;
            align-items: flex-start;
            gap: var(--s3);
            padding: var(--s3);
            background: var(--vscode-editor-background);
            border: 1px solid var(--color-faint);
            border-radius: var(--radius-sharp);
        }

        .command-row .command-tag {
            min-width: 100px;
        }

        .command-desc {
            font-size: 12px;
            color: var(--color-secondary);
            flex: 1;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
            animation: fadeIn var(--anim-standard);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-title">
            <h1>Specky</h1>
        </div>
        <div class="header-actions">
            <button class="secondary" data-action="refresh">
                <i class="codicon codicon-refresh"></i>
                Refresh
            </button>
            <button data-action="command" data-command="specify">
                <i class="codicon codicon-add"></i>
                New Feature
            </button>
            <button class="secondary" data-action="show-tab" data-tab="guide">
                <i class="codicon codicon-question"></i>
                Help
            </button>
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

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentState = { features: [], activeFeature: null, loading: true };
        let currentTab = 'features';

        // HTML escape function to prevent XSS
        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            const div = document.createElement('div');
            div.textContent = String(str);
            return div.innerHTML;
        }

        // Event delegation for all clicks
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;

            switch (action) {
                case 'refresh':
                    vscode.postMessage({ type: 'refreshRequest' });
                    break;
                case 'command':
                    vscode.postMessage({
                        type: 'runCommand',
                        command: target.dataset.command,
                        featureId: currentState.activeFeature?.id
                    });
                    break;
                case 'show-tab':
                    currentTab = target.dataset.tab;
                    render();
                    break;
                case 'select-feature':
                    currentTab = 'features';
                    vscode.postMessage({ type: 'selectFeature', featureId: target.dataset.featureId });
                    break;
                case 'open-artifact':
                    vscode.postMessage({
                        type: 'openArtifact',
                        featureId: target.dataset.featureId,
                        artifactType: target.dataset.artifactType
                    });
                    break;
            }
        });

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
                container.innerHTML = '<div style="padding: var(--s4); text-align: center; color: var(--color-secondary); font-size: 12px; border: 1px dashed var(--color-faint); border-radius: var(--radius-sharp);">No features found.</div>';
                return;
            }

            container.innerHTML = currentState.features.map(feature => {
                const isActive = currentState.activeFeature?.id === feature.id && currentTab === 'features';
                const { totalTasks, completedTasks, percentage } = feature.progress;
                const escapedName = escapeHtml(feature.name);
                const escapedId = escapeHtml(feature.id);

                return \`
                    <div class="feature-card \${isActive ? 'active' : ''}" data-action="select-feature" data-feature-id="\${escapedId}">
                        <div class="feature-info">
                            <div class="feature-name" title="\${escapedName}">\${escapedName}</div>
                            <div class="feature-number">#\${feature.number.toString().padStart(3, '0')}</div>
                        </div>
                        <div class="feature-progress-mini">
                            <div class="progress-bar-mini">
                                <div class="progress-fill-mini \${percentage === 100 ? 'complete' : ''}" style="width: \${percentage}%"></div>
                            </div>
                            <div class="progress-text-mini">\${percentage}%</div>
                        </div>
                    </div>
                \`;
            }).join('');
        }

        function renderMainContent() {
            const container = document.getElementById('main-content');

            if (currentTab === 'guide') {
                container.innerHTML = renderGuide();
                return;
            }

            const feature = currentState.activeFeature;

            if (!feature) {
                container.innerHTML = \`
                    <div class="empty-state animate-fade-in">
                        <div class="empty-icon-box">
                            <i class="codicon codicon-files"></i>
                        </div>
                        <h3>No Feature Selected</h3>
                        <p>Select a feature from the sidebar to view implementation details and progress.</p>
                        <button data-action="command" data-command="specify">
                            <i class="codicon codicon-wand"></i>
                            Create First Specification
                        </button>
                    </div>
                \`;
                return;
            }

            const escapedFeatureName = escapeHtml(feature.name);
            const escapedFeatureId = escapeHtml(feature.id);

            const artifacts = [
                { type: 'spec', name: 'Specification', icon: 'codicon-file-text', exists: feature.artifacts.spec?.exists },
                { type: 'plan', name: 'Plan', icon: 'codicon-map', exists: feature.artifacts.plan?.exists },
                { type: 'tasks', name: 'Tasks', icon: 'codicon-tasklist', exists: feature.artifacts.tasks?.exists }
            ];

            const nextStep = getNextStep(feature);

            container.innerHTML = \`
                <div class="detail-view animate-fade-in">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title-group">
                                <div class="card-title">\${escapedFeatureName}</div>
                                <div class="card-subtitle">\${escapedFeatureId}</div>
                            </div>
                            <div class="feature-number" style="font-size: 16px; opacity: 1; font-weight: 600;">#\${feature.number.toString().padStart(3, '0')}</div>
                        </div>

                        <div class="artifacts-grid">
                            \${artifacts.map(a => \`
                                <div class="artifact-card \${a.exists ? 'exists' : ''}"
                                     data-action="\${a.exists ? 'open-artifact' : 'command'}"
                                     data-feature-id="\${escapedFeatureId}"
                                     data-artifact-type="\${a.type}"
                                     data-command="\${a.type === 'spec' ? 'specify' : a.type === 'plan' ? 'plan' : 'tasks'}">
                                    <div class="artifact-card-top">
                                        <div class="artifact-icon-box">
                                            <i class="codicon \${a.icon}"></i>
                                        </div>
                                        <div class="artifact-status-dot \${a.exists ? 'exists' : ''}"></div>
                                    </div>
                                    <div>
                                        <div class="artifact-name">\${a.name}</div>
                                        <div class="artifact-status-text">\${a.exists ? 'Available' : 'Missing'}</div>
                                    </div>
                                </div>
                            \`).join('')}
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header" style="margin-bottom: var(--s4)">
                            <div class="card-title" style="font-size: 14px;">Implementation Status</div>
                        </div>
                        <div class="progress-section">
                            <div class="progress-label-group">
                                <span class="progress-label">Completion</span>
                                <span class="progress-value">\${feature.progress.completedTasks} / \${feature.progress.totalTasks} Tasks (\${feature.progress.percentage}%)</span>
                            </div>
                            <div class="progress-bar-large">
                                <div class="progress-fill-large \${feature.progress.percentage === 100 ? 'complete' : ''}" style="width: \${feature.progress.percentage}%"></div>
                            </div>

                            \${nextStep ? \`
                                <div class="next-step-card" style="margin-top: var(--s2)">
                                    <i class="codicon codicon-info next-step-icon"></i>
                                    <div class="next-step-content">
                                        <div class="next-step-title">Recommended Next Step</div>
                                        <div class="next-step-desc">\${escapeHtml(nextStep.text)}</div>
                                        <button data-action="command" data-command="\${nextStep.command}">
                                            <i class="codicon \${nextStep.icon}"></i>
                                            \${escapeHtml(nextStep.buttonText)}
                                        </button>
                                    </div>
                                </div>
                            \` : ''}
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header" style="margin-bottom: var(--s4)">
                            <div class="card-title" style="font-size: 14px;">Quick Actions</div>
                        </div>
                        <div class="actions-group">
                            <button class="secondary" data-action="command" data-command="specify">
                                <i class="codicon codicon-edit"></i>
                                Refine Spec
                            </button>
                            <button class="secondary" data-action="command" data-command="clarify">
                                <i class="codicon codicon-question"></i>
                                Clarify Spec
                            </button>
                            <button class="secondary" data-action="command" data-command="plan">
                                <i class="codicon codicon-git-merge"></i>
                                Update Plan
                            </button>
                            <button class="secondary" data-action="command" data-command="tasks">
                                <i class="codicon codicon-list-unordered"></i>
                                Update Tasks
                            </button>
                            <button data-action="command" data-command="implement">
                                <i class="codicon codicon-rocket"></i>
                                Implement Next
                            </button>
                        </div>
                    </div>
                </div>
            \`;
        }

        function renderGuide() {
            return \`
                <div class="detail-view animate-fade-in">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title-group">
                                <div class="card-title">How to Use Specky</div>
                                <div class="card-subtitle">Spec-driven development workflow</div>
                            </div>
                            <button class="secondary" data-action="show-tab" data-tab="features" style="height: 28px; font-size: 12px;">
                                <i class="codicon codicon-close"></i>
                                Close
                            </button>
                        </div>

                        <div class="guide-section">
                            <div class="guide-section-title">
                                <i class="codicon codicon-type-hierarchy"></i>
                                The Specky Workflow
                            </div>
                            <div class="workflow-steps">
                                <div class="workflow-step">
                                    <div class="step-number">1</div>
                                    <div class="step-content">
                                        <div class="step-title">Specify Your Feature</div>
                                        <div class="step-desc">
                                            Open the chat panel and type <span class="command-tag">@specky /specify</span> followed by a description of what you want to build.
                                            Specky will generate a detailed specification document with requirements, user stories, and acceptance criteria.
                                        </div>
                                    </div>
                                </div>
                                <div class="workflow-step">
                                    <div class="step-number">2</div>
                                    <div class="step-content">
                                        <div class="step-title">Clarify Requirements</div>
                                        <div class="step-desc">
                                            Use <span class="command-tag">@specky /clarify</span> to ask questions about edge cases, constraints, or ambiguities.
                                            This refines your spec and ensures nothing is missed before implementation begins.
                                        </div>
                                    </div>
                                </div>
                                <div class="workflow-step">
                                    <div class="step-number">3</div>
                                    <div class="step-content">
                                        <div class="step-title">Create a Technical Plan</div>
                                        <div class="step-desc">
                                            Run <span class="command-tag">@specky /plan</span> to generate an implementation plan.
                                            This creates a high-level architecture with components, data models, and integration points.
                                        </div>
                                    </div>
                                </div>
                                <div class="workflow-step">
                                    <div class="step-number">4</div>
                                    <div class="step-content">
                                        <div class="step-title">Break Down into Tasks</div>
                                        <div class="step-desc">
                                            Use <span class="command-tag">@specky /tasks</span> to convert the plan into actionable implementation tasks.
                                            Each task is scoped to be completable in a single coding session.
                                        </div>
                                    </div>
                                </div>
                                <div class="workflow-step">
                                    <div class="step-number">5</div>
                                    <div class="step-content">
                                        <div class="step-title">Implement Step by Step</div>
                                        <div class="step-desc">
                                            Call <span class="command-tag">@specky /implement</span> to work through tasks one at a time.
                                            Specky guides the implementation based on your spec, plan, and remaining tasks.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="guide-section">
                            <div class="guide-section-title">
                                <i class="codicon codicon-settings"></i>
                                Implement Options
                            </div>
                            <div class="commands-list">
                                <div class="command-row">
                                    <span class="command-tag">--review</span>
                                    <span class="command-desc">Run a code review step before auto-completing the task.</span>
                                </div>
                                <div class="command-row">
                                    <span class="command-tag">--dry-run</span>
                                    <span class="command-desc">Preview the proposed file changes in diff views without writing files.</span>
                                </div>
                                <div class="command-row">
                                    <span class="command-tag">--task 3</span>
                                    <span class="command-desc">Select a specific task by index (1-based) instead of the next incomplete one.</span>
                                </div>
                                <div class="command-row">
                                    <span class="command-tag">--model gpt-4o</span>
                                    <span class="command-desc">Temporarily override the model used for this run.</span>
                                </div>
                            </div>

                            <div style="margin-top: var(--s3); font-size: 12px; color: var(--color-secondary);">
                                Example: <span class="command-tag">@specky /implement 3 --dry-run --review</span>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header" style="margin-bottom: var(--s4)">
                            <div class="card-title" style="font-size: 14px;">Available Commands</div>
                        </div>
                        <div class="commands-list">
                            <div class="command-row">
                                <span class="command-tag">/specify</span>
                                <span class="command-desc">Generate a new feature specification from a description. Creates requirements, user stories, and acceptance criteria.</span>
                            </div>
                            <div class="command-row">
                                <span class="command-tag">/clarify</span>
                                <span class="command-desc">Ask clarifying questions about a spec. Helps identify edge cases and refine requirements before implementation.</span>
                            </div>
                            <div class="command-row">
                                <span class="command-tag">/plan</span>
                                <span class="command-desc">Create a technical implementation plan based on the specification. Outlines architecture and components.</span>
                            </div>
                            <div class="command-row">
                                <span class="command-tag">/tasks</span>
                                <span class="command-desc">Break down the plan into granular, implementable tasks with clear completion criteria.</span>
                            </div>
                            <div class="command-row">
                                <span class="command-tag">/implement</span>
                                <span class="command-desc">Start or continue implementation. Supports task selection, dry-run diffs, and optional review.</span>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header" style="margin-bottom: var(--s4)">
                            <div class="card-title" style="font-size: 14px;">
                                <i class="codicon codicon-lightbulb" style="color: var(--vscode-charts-yellow); margin-right: var(--s1);"></i>
                                Tips &amp; Tricks
                            </div>
                        </div>
                        <div class="tips-grid">
                            <div class="tip-card">
                                <div class="tip-header">
                                    <i class="codicon codicon-target"></i>
                                    <span class="tip-title">Be Specific Early</span>
                                </div>
                                <div class="tip-desc">
                                    The more detail you provide in the initial /specify command, the better your spec will be.
                                    Include constraints, user types, and expected behaviors upfront.
                                </div>
                            </div>
                            <div class="tip-card">
                                <div class="tip-header">
                                    <i class="codicon codicon-split-horizontal"></i>
                                    <span class="tip-title">Split Large Features</span>
                                </div>
                                <div class="tip-desc">
                                    If a feature feels too big, break it into multiple smaller specs.
                                    Each spec should represent a shippable increment of functionality.
                                </div>
                            </div>
                            <div class="tip-card">
                                <div class="tip-header">
                                    <i class="codicon codicon-edit"></i>
                                    <span class="tip-title">Edit Your Artifacts</span>
                                </div>
                                <div class="tip-desc">
                                    Spec, plan, and task files are regular Markdown. Feel free to edit them directly
                                    to add details, fix issues, or adjust priorities.
                                </div>
                            </div>
                            <div class="tip-card">
                                <div class="tip-header">
                                    <i class="codicon codicon-comment-discussion"></i>
                                    <span class="tip-title">Use Clarify Often</span>
                                </div>
                                <div class="tip-desc">
                                    The /clarify command is your friend. Use it whenever you're unsure about requirements—it's
                                    cheaper to clarify than to reimplement.
                                </div>
                            </div>
                            <div class="tip-card">
                                <div class="tip-header">
                                    <i class="codicon codicon-folder-opened"></i>
                                    <span class="tip-title">Check the .specky Folder</span>
                                </div>
                                <div class="tip-desc">
                                    All artifacts live in your workspace's <code>.specky/</code> folder. Each feature has its own subdirectory
                                    containing <code>spec.md</code>, <code>plan.md</code>, and <code>tasks.md</code>.
                                </div>
                            </div>
                            <div class="tip-card">
                                <div class="tip-header">
                                    <i class="codicon codicon-history"></i>
                                    <span class="tip-title">Iterate Your Spec</span>
                                </div>
                                <div class="tip-desc">
                                    Run /specify again on an existing feature to refine it. Specky will update the spec
                                    while preserving your existing work and progress.
                                </div>
                            </div>

                            <div class="tip-card">
                                <div class="tip-header">
                                    <i class="codicon codicon-diff"></i>
                                    <span class="tip-title">Preview Before Applying</span>
                                </div>
                                <div class="tip-desc">
                                    If you want to inspect changes before writing files, use <code>--dry-run</code> with <code>/implement</code>
                                    to open diff previews for each proposed file.
                                </div>
                            </div>

                            <div class="tip-card">
                                <div class="tip-header">
                                    <i class="codicon codicon-terminal"></i>
                                    <span class="tip-title">Run Commands From Chat</span>
                                </div>
                                <div class="tip-desc">
                                    When Specky suggests shell commands, you can run them via one-click links. Specky will always ask for confirmation first.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header" style="margin-bottom: var(--s4)">
                            <div class="card-title" style="font-size: 14px;">Keyboard Shortcuts</div>
                        </div>
                        <div class="commands-list">
                            <div class="command-row">
                                <span class="command-tag" style="min-width: 140px;">Ctrl+Shift+P</span>
                                <span class="command-desc">Open Command Palette, then search for "Specky" to access all commands.</span>
                            </div>
                            <div class="command-row">
                                <span class="command-tag" style="min-width: 140px;">Ctrl+Shift+I</span>
                                <span class="command-desc">Open Copilot Chat (or your configured chat shortcut) to use @specky commands.</span>
                            </div>
                        </div>
                    </div>
                </div>
            \`;
        }

        function getNextStep(feature) {
            if (!feature.artifacts.spec?.exists) {
                return { text: "Start by generating a specification for this feature.", command: "specify", buttonText: "Generate Spec", icon: "codicon-wand" };
            }
            if (!feature.artifacts.plan?.exists) {
                return { text: "Specification is ready. Now create a technical implementation plan.", command: "plan", buttonText: "Create Plan", icon: "codicon-map" };
            }
            if (!feature.artifacts.tasks?.exists) {
                return { text: "Plan is defined. Break it down into implementable tasks.", command: "tasks", buttonText: "Break Down Tasks", icon: "codicon-tasklist" };
            }
            if (feature.progress.percentage < 100) {
                return { text: "Everything is set. Start implementing the tasks step by step.", command: "implement", buttonText: "Continue Implementation", icon: "codicon-rocket" };
            }
            return null;
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

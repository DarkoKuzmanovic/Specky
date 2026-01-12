/**
 * Specky - VS Code Extension
 * Spec-driven development workflow for GitHub Copilot
 *
 * @author Darko Kuzmanovic <darko.kuzmanovic@gmail.com>
 * @license MIT
 */

import * as vscode from "vscode";
import { SpeckyFileManager, ModelSelector, QualityGateService, ProgressTracker } from "./services/index.js";
import { SpeckyTreeProvider, SpeckyStatusBar, SpeckyDashboard } from "./views/index.js";
import { SpeckyChatParticipant } from "./chat/index.js";
import { ArtifactType } from "./types.js";

let fileManager: SpeckyFileManager;
let modelSelector: ModelSelector;
let qualityGate: QualityGateService;
let progressTracker: ProgressTracker;
let treeProvider: SpeckyTreeProvider;
let statusBar: SpeckyStatusBar;
let chatParticipant: SpeckyChatParticipant;

export function activate(context: vscode.ExtensionContext): void {
  // Get workspace root
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    // No workspace - register minimal commands
    registerMinimalCommands(context);
    return;
  }

  // M-4: Check workspace trust before enabling file watchers and webview
  if (!vscode.workspace.isTrusted) {
    // Register minimal commands for untrusted workspaces
    registerMinimalCommands(context);

    // Re-activate when workspace becomes trusted
    context.subscriptions.push(
      vscode.workspace.onDidGrantWorkspaceTrust(() => {
        // Dispose existing registrations and re-activate
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      })
    );
    return;
  }

  // Initialize services
  fileManager = new SpeckyFileManager(workspaceFolder.uri);
  modelSelector = new ModelSelector();
  qualityGate = new QualityGateService(fileManager);
  progressTracker = new ProgressTracker(fileManager);

  // Initialize views
  treeProvider = new SpeckyTreeProvider(fileManager);
  statusBar = new SpeckyStatusBar(fileManager, progressTracker);

  // Initialize chat participant
  chatParticipant = new SpeckyChatParticipant(fileManager, modelSelector, qualityGate, progressTracker);

  // Register tree view
  const treeView = vscode.window.createTreeView("speckyArtifacts", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // Register commands
  registerCommands(context);

  // Add disposables
  context.subscriptions.push(
    treeView,
    { dispose: () => fileManager.dispose() },
    { dispose: () => progressTracker.dispose() },
    { dispose: () => treeProvider.dispose() },
    { dispose: () => statusBar.dispose() },
    { dispose: () => chatParticipant.dispose() }
  );

  // Log activation
  console.log("Specky extension activated");
}

function registerCommands(context: vscode.ExtensionContext): void {
  // Open Dashboard
  context.subscriptions.push(
    vscode.commands.registerCommand("specky.openDashboard", () => {
      SpeckyDashboard.createOrShow(context.extensionUri, fileManager, progressTracker);
    })
  );

  // Create New Specification
  context.subscriptions.push(
    vscode.commands.registerCommand("specky.createSpec", async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Enter a name for the new feature",
        placeHolder: "e.g., user-authentication",
      });

      if (name) {
        const feature = await fileManager.createFeature(name);
        vscode.window.showInformationMessage(`Created feature: ${feature.name}`);

        // Ensure the chat participant uses this feature instead of creating a new one.
        treeProvider.setActiveFeature(feature);
        statusBar.setActiveFeature(feature);
        chatParticipant.setActiveFeature(feature);

        if (SpeckyDashboard.currentPanel) {
          SpeckyDashboard.currentPanel.setActiveFeature(feature);
        }

        // Open chat with /specify
        await vscode.commands.executeCommand("workbench.action.chat.open", {
          query: `@specky /specify Create a specification for: ${name}`,
        });
      }
    })
  );

  // Refresh Artifacts
  context.subscriptions.push(
    vscode.commands.registerCommand("specky.refreshArtifacts", () => {
      treeProvider.refresh();
      statusBar.update();
    })
  );

  // Open Artifact
  context.subscriptions.push(
    vscode.commands.registerCommand("specky.openArtifact", async (featureId: string, artifactType: ArtifactType) => {
      const uri = fileManager.getArtifactUri(featureId, artifactType);
      try {
        await vscode.window.showTextDocument(uri);
      } catch {
        vscode.window.showWarningMessage(`Artifact not found: ${artifactType}.md`);
      }
    })
  );

  // Set Active Feature
  context.subscriptions.push(
    vscode.commands.registerCommand("specky.setActiveFeature", async (featureId: string) => {
      const feature = await fileManager.getFeature(featureId);
      if (feature) {
        treeProvider.setActiveFeature(feature);
        statusBar.setActiveFeature(feature);
        chatParticipant.setActiveFeature(feature);

        if (SpeckyDashboard.currentPanel) {
          SpeckyDashboard.currentPanel.setActiveFeature(feature);
        }

        vscode.window.showInformationMessage(`Active feature: ${feature.name}`);
      }
    })
  );

  // Toggle Task
  context.subscriptions.push(
    vscode.commands.registerCommand("specky.toggleTask", async (featureId: string, taskId: string) => {
      await progressTracker.toggleTask(featureId, taskId);
    })
  );

  // Select Model for specific command (called from tree view)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "specky.selectModelForCommand",
      async (commandId: string, commandLabel: string, settingKey: string) => {
        const availableModels = await modelSelector.listAvailableModels();
        const currentModel = vscode.workspace.getConfiguration("specky").get<string>(settingKey);

        const modelItems = availableModels.map((m) => ({
          label: m.name,
          description: `${m.vendor} - ${m.family}`,
          id: m.id,
          picked: m.id === currentModel || m.family === currentModel,
        }));

        const selectedModel = await vscode.window.showQuickPick(modelItems, {
          placeHolder: `Select model for ${commandLabel}`,
        });

        if (selectedModel) {
          await vscode.workspace
            .getConfiguration("specky")
            .update(settingKey, selectedModel.id, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`Updated ${commandLabel} model to ${selectedModel.label}`);
        }
      }
    )
  );
}

function registerMinimalCommands(context: vscode.ExtensionContext): void {
  // Minimal commands when no workspace is open
  context.subscriptions.push(
    vscode.commands.registerCommand("specky.openDashboard", () => {
      vscode.window.showWarningMessage("Specky requires an open workspace folder");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("specky.createSpec", () => {
      vscode.window.showWarningMessage("Specky requires an open workspace folder");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("specky.refreshArtifacts", () => {
      // No-op
    })
  );
}

export function deactivate(): void {
  console.log("Specky extension deactivated");
}

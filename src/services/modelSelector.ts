/**
 * Specky - Model Selector
 * Handles model selection and override parsing for chat commands
 */

import * as vscode from "vscode";
import { SpeckyCommand, SpeckyModel, ModelOverride } from "../types.js";

/**
 * Commands that use the planning model
 */
const PLANNING_COMMANDS: SpeckyCommand[] = ["specify", "plan", "tasks", "clarify"];

/**
 * Commands that use the implementation model
 */
const IMPLEMENTATION_COMMANDS: SpeckyCommand[] = ["implement"];

/**
 * Model family mappings for vscode.lm.selectChatModels
 */
const MODEL_FAMILIES: Record<string, string> = {
  "claude-opus-4.5": "claude-opus-4.5",
  "claude-sonnet-4.5": "claude-sonnet-4.5",
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini",
  o1: "o1",
  "o1-mini": "o1-mini",
};

export class ModelSelector {
  /**
   * Parse --model override from prompt
   * Returns the model and cleaned prompt without the flag
   */
  parseModelOverride(prompt: string): ModelOverride | null {
    const regex = /--model\s+(\S+)/i;
    const match = prompt.match(regex);

    if (!match) {
      return null;
    }

    const modelName = match[1].toLowerCase();

    return {
      model: modelName,
      cleanPrompt: prompt.replace(regex, "").trim(),
    };
  }

  /**
   * Get the configured model for a command
   */
  getConfiguredModel(command: SpeckyCommand): string {
    const config = vscode.workspace.getConfiguration("specky");

    // Check for per-command settings first
    if (command === "specify") {
      const model = config.get<string>("specifyModel");
      if (model) {
        return model;
      }
    } else if (command === "plan") {
      const model = config.get<string>("planModel");
      if (model) {
        return model;
      }
    } else if (command === "tasks") {
      const model = config.get<string>("tasksModel");
      if (model) {
        return model;
      }
    }

    if (PLANNING_COMMANDS.includes(command)) {
      return config.get<string>("planningModel", "claude-opus-4.5");
    }

    if (IMPLEMENTATION_COMMANDS.includes(command)) {
      return config.get<string>("implementationModel", "claude-sonnet-4.5");
    }

    // Default to planning model
    return config.get<string>("planningModel", "claude-opus-4.5");
  }

  /**
   * Get the effective model for a command with potential override
   */
  getEffectiveModel(
    command: SpeckyCommand,
    prompt: string
  ): {
    model: string;
    cleanPrompt: string;
  } {
    const override = this.parseModelOverride(prompt);

    if (override) {
      return {
        model: override.model,
        cleanPrompt: override.cleanPrompt,
      };
    }

    return {
      model: this.getConfiguredModel(command),
      cleanPrompt: prompt,
    };
  }

  /**
   * Select a language model from VS Code
   * Returns the requested model if available, falls back to default
   */
  async selectModel(
    requestedModel: string,
    fallbackModel: vscode.LanguageModelChat
  ): Promise<vscode.LanguageModelChat> {
    try {
      // First try to find by ID exactly
      let models = await vscode.lm.selectChatModels({
        vendor: "copilot",
        id: requestedModel,
      });

      if (models.length === 0) {
        // Try by family (using our mapping or the string itself)
        const family = MODEL_FAMILIES[requestedModel as SpeckyModel] || requestedModel;
        models = await vscode.lm.selectChatModels({
          vendor: "copilot",
          family,
        });
      }

      if (models.length > 0) {
        return models[0];
      }

      // Silent fallback to the request's default model
      return fallbackModel;
    } catch {
      // Any error, fall back silently
      return fallbackModel;
    }
  }

  /**
   * List all available Copilot models
   */
  async listAvailableModels(): Promise<vscode.LanguageModelChat[]> {
    try {
      return await vscode.lm.selectChatModels({ vendor: "copilot" });
    } catch {
      return [];
    }
  }

  /**
   * Get human-readable model name
   */
  getModelDisplayName(model: string): string {
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

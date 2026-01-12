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
 * Cached model information for display and lookup
 */
interface CachedModel {
  id: string;
  name: string;
  family: string;
  vendor: string;
  displayName: string;
}

export class ModelSelector {
  /**
   * Cache of discovered models (updated on each listAvailableModels call)
   */
  private _modelCache: Map<string, CachedModel> = new Map();

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
   * Now supports custom models from any vendor, not just Copilot
   */
  async selectModel(
    requestedModel: string,
    fallbackModel: vscode.LanguageModelChat
  ): Promise<vscode.LanguageModelChat> {
    try {
      const normalizedRequest = requestedModel.toLowerCase();

      // Get ALL available models (from all vendors, including custom ones)
      const allModels = await vscode.lm.selectChatModels({});

      // First try exact ID match
      let found = allModels.find((m) => m.id.toLowerCase() === normalizedRequest);

      if (!found) {
        // Try matching by family
        found = allModels.find((m) => m.family.toLowerCase() === normalizedRequest);
      }

      if (!found) {
        // Try partial match on ID (e.g., "glm-4.7" matches "z.ai/glm-4.7")
        found = allModels.find((m) => m.id.toLowerCase().includes(normalizedRequest));
      }

      if (!found) {
        // Try matching by name
        found = allModels.find((m) => m.name.toLowerCase().includes(normalizedRequest));
      }

      if (found) {
        return found;
      }

      // Silent fallback to the request's default model
      return fallbackModel;
    } catch {
      // Any error, fall back silently
      return fallbackModel;
    }
  }

  /**
   * List all available language models from ALL vendors
   * Includes Copilot models and custom models (e.g., Generic Compatible)
   */
  async listAvailableModels(): Promise<vscode.LanguageModelChat[]> {
    try {
      // Empty selector returns ALL models from ALL vendors
      const models = await vscode.lm.selectChatModels({});

      // Update the cache for display name lookups
      this._modelCache.clear();
      for (const model of models) {
        this._modelCache.set(model.id.toLowerCase(), {
          id: model.id,
          name: model.name,
          family: model.family,
          vendor: model.vendor,
          displayName: this._formatDisplayName(model),
        });
      }

      return models;
    } catch {
      return [];
    }
  }

  /**
   * List only Copilot models (for backward compatibility)
   */
  async listCopilotModels(): Promise<vscode.LanguageModelChat[]> {
    try {
      return await vscode.lm.selectChatModels({ vendor: "copilot" });
    } catch {
      return [];
    }
  }

  /**
   * Get cached models info (call listAvailableModels first to populate)
   */
  getCachedModels(): CachedModel[] {
    return Array.from(this._modelCache.values());
  }

  /**
   * Format a display name for a model
   */
  private _formatDisplayName(model: vscode.LanguageModelChat): string {
    // For non-Copilot models, include vendor info
    if (model.vendor !== "copilot") {
      return `${model.name} (${model.vendor})`;
    }
    return model.name;
  }

  /**
   * Get human-readable model name
   * Now dynamically looks up from cache, with fallback to known names
   */
  getModelDisplayName(model: string): string {
    const normalizedModel = model.toLowerCase();

    // Check cache first (populated by listAvailableModels)
    const cached = this._modelCache.get(normalizedModel);
    if (cached) {
      return cached.displayName;
    }

    // Fallback to known Copilot models
    const knownNames: Record<string, string> = {
      "claude-opus-4.5": "Claude Opus 4.5",
      "claude-sonnet-4.5": "Claude Sonnet 4.5",
      "gpt-4o": "GPT-4o",
      "gpt-4o-mini": "GPT-4o Mini",
      o1: "o1",
      "o1-mini": "o1 Mini",
    };

    return knownNames[normalizedModel] || model;
  }
}

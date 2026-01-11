/**
 * Specky - Core Types
 * Type definitions for the spec-driven development workflow
 */

/**
 * Supported AI models for Specky commands
 */
export type SpeckyModel = string;

/**
 * Slash command names
 */
export type SpeckyCommand = "specify" | "plan" | "tasks" | "implement" | "clarify";

/**
 * Artifact types that Specky manages
 */
export type ArtifactType = "spec" | "plan" | "tasks";

/**
 * File names for each artifact type
 */
export const ARTIFACT_FILES: Record<ArtifactType, string> = {
  spec: "spec.md",
  plan: "plan.md",
  tasks: "tasks.md",
};

/**
 * Task status parsed from markdown checkboxes
 */
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  lineNumber: number;
  subtasks?: Task[];
}

/**
 * A feature with its associated artifacts
 */
export interface Feature {
  /** Directory name (e.g., "001-user-auth") */
  id: string;
  /** Numeric prefix (e.g., 1) */
  number: number;
  /** Feature name (e.g., "user-auth") */
  name: string;
  /** Absolute path to feature directory */
  path: string;
  /** Available artifacts */
  artifacts: {
    spec?: FeatureArtifact;
    plan?: FeatureArtifact;
    tasks?: FeatureArtifact;
  };
  /** Progress summary */
  progress: FeatureProgress;
}

/**
 * A single artifact file
 */
export interface FeatureArtifact {
  type: ArtifactType;
  path: string;
  exists: boolean;
  lastModified?: number;
  content?: string;
}

/**
 * Progress tracking for a feature
 */
export interface FeatureProgress {
  totalTasks: number;
  completedTasks: number;
  percentage: number;
}

/**
 * Quality gate result
 */
export interface QualityGateResult {
  passed: boolean;
  checks: QualityCheck[];
  summary: string;
}

/**
 * Individual quality check
 */
export interface QualityCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: "error" | "warning" | "info";
}

/**
 * Parsed model override from prompt
 */
export interface ModelOverride {
  model: SpeckyModel;
  cleanPrompt: string;
}

/**
 * Clarification question for /clarify command
 */
export interface ClarificationQuestion {
  id: string;
  category: "scope" | "behavior" | "technical" | "edge-case" | "integration";
  question: string;
  context: string;
  suggestedDefault?: string;
}

/**
 * Dashboard state for webview
 */
export interface DashboardState {
  features: Feature[];
  activeFeature: Feature | null;
  loading: boolean;
  error?: string;
}

/**
 * Messages from webview to extension
 */
export type WebviewMessage =
  | { type: "ready" }
  | { type: "refreshRequest" }
  | { type: "selectFeature"; featureId: string }
  | { type: "toggleTask"; featureId: string; taskId: string }
  | { type: "openArtifact"; featureId: string; artifactType: ArtifactType }
  | { type: "runCommand"; command: SpeckyCommand; featureId: string };

/**
 * Messages from extension to webview
 */
export type ExtensionMessage = { type: "stateUpdate"; state: DashboardState } | { type: "error"; message: string };

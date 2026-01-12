/**
 * Specky - Quality Gate Service
 * Validates artifacts before allowing implementation
 */

import { SpeckyFileManager } from "./fileManager.js";
import { QualityGateResult, QualityCheck, Feature } from "../types.js";

export class QualityGateService {
  constructor(private readonly fileManager: SpeckyFileManager) {}

  /**
   * Run all quality checks for a feature
   */
  async validateForImplementation(featureId: string): Promise<QualityGateResult> {
    const feature = await this.fileManager.getFeature(featureId);

    if (!feature) {
      return {
        passed: false,
        checks: [
          {
            name: "Feature Exists",
            passed: false,
            message: `Feature "${featureId}" not found`,
            severity: "error",
          },
        ],
        summary: "Feature not found",
      };
    }

    const checks: QualityCheck[] = [];

    // Check spec exists
    checks.push(await this.checkSpecExists(feature));

    // Check plan exists
    checks.push(await this.checkPlanExists(feature));

    // Check tasks exist
    checks.push(await this.checkTasksExist(feature));

    // Check spec completeness
    checks.push(await this.checkSpecCompleteness(feature));

    // Check plan completeness
    checks.push(await this.checkPlanCompleteness(feature));

    // Check for incomplete tasks
    checks.push(await this.checkTasksProgress(feature));

    const errors = checks.filter((c) => c.severity === "error" && !c.passed);
    const warnings = checks.filter((c) => c.severity === "warning" && !c.passed);

    const passed = errors.length === 0;

    let summary: string;
    if (passed && warnings.length === 0) {
      summary = "✅ All quality gates passed. Ready for implementation.";
    } else if (passed) {
      summary = `⚠️ Ready with ${warnings.length} warning(s)`;
    } else {
      summary = `❌ ${errors.length} error(s) must be resolved before implementation`;
    }

    return { passed, checks, summary };
  }

  private async checkSpecExists(feature: Feature): Promise<QualityCheck> {
    const exists = feature.artifacts.spec?.exists ?? false;
    return {
      name: "Specification Exists",
      passed: exists,
      message: exists ? "spec.md found" : "Missing spec.md - run /specify first",
      severity: "error",
    };
  }

  private async checkPlanExists(feature: Feature): Promise<QualityCheck> {
    const exists = feature.artifacts.plan?.exists ?? false;
    return {
      name: "Plan Exists",
      passed: exists,
      message: exists ? "plan.md found" : "Missing plan.md - run /plan first",
      severity: "error",
    };
  }

  private async checkTasksExist(feature: Feature): Promise<QualityCheck> {
    const exists = feature.artifacts.tasks?.exists ?? false;
    return {
      name: "Tasks Exist",
      passed: exists,
      message: exists ? "tasks.md found" : "Missing tasks.md - run /tasks first",
      severity: "error",
    };
  }

  private async checkSpecCompleteness(feature: Feature): Promise<QualityCheck> {
    if (!feature.artifacts.spec?.exists) {
      return {
        name: "Specification Complete",
        passed: false,
        message: "Cannot check - spec.md missing",
        severity: "info",
      };
    }

    try {
      const content = await this.fileManager.readArtifact(feature.id, "spec");
      if (!content) {
        return {
          name: "Specification Complete",
          passed: false,
          message: "Could not read spec.md",
          severity: "warning",
        };
      }

      // Check for required sections
      // Keep in sync with the /specify output format in src/chat/prompts.ts
      const requiredSections = ["## Problem Statement", "## Functional Requirements", "## Error Scenarios"];
      const missingSections = requiredSections.filter(
        (section) => !content.toLowerCase().includes(section.toLowerCase())
      );

      if (missingSections.length > 0) {
        return {
          name: "Specification Complete",
          passed: false,
          message: `Missing sections: ${missingSections.join(", ")}`,
          severity: "warning",
        };
      }

      // Check for TODO markers
      if (content.includes("TODO") || content.includes("TBD")) {
        return {
          name: "Specification Complete",
          passed: false,
          message: "Spec contains TODO/TBD markers",
          severity: "warning",
        };
      }

      return {
        name: "Specification Complete",
        passed: true,
        message: "All required sections present",
        severity: "info",
      };
    } catch {
      return {
        name: "Specification Complete",
        passed: false,
        message: "Error checking specification",
        severity: "warning",
      };
    }
  }

  private async checkPlanCompleteness(feature: Feature): Promise<QualityCheck> {
    if (!feature.artifacts.plan?.exists) {
      return {
        name: "Plan Complete",
        passed: false,
        message: "Cannot check - plan.md missing",
        severity: "info",
      };
    }

    try {
      const content = await this.fileManager.readArtifact(feature.id, "plan");
      if (!content) {
        return {
          name: "Plan Complete",
          passed: false,
          message: "Could not read plan.md",
          severity: "warning",
        };
      }

      // Check minimum content length
      if (content.length < 500) {
        return {
          name: "Plan Complete",
          passed: false,
          message: "Plan seems too short - consider adding more detail",
          severity: "warning",
        };
      }

      return {
        name: "Plan Complete",
        passed: true,
        message: "Plan has sufficient detail",
        severity: "info",
      };
    } catch {
      return {
        name: "Plan Complete",
        passed: false,
        message: "Error checking plan",
        severity: "warning",
      };
    }
  }

  private async checkTasksProgress(feature: Feature): Promise<QualityCheck> {
    const { totalTasks, completedTasks, percentage } = feature.progress;

    if (totalTasks === 0) {
      return {
        name: "Tasks Defined",
        passed: false,
        message: "No tasks found in tasks.md",
        severity: "warning",
      };
    }

    return {
      name: "Tasks Progress",
      passed: true,
      message: `${completedTasks}/${totalTasks} tasks complete (${percentage}%)`,
      severity: "info",
    };
  }

  /**
   * Format quality gate results for display
   */
  formatResults(result: QualityGateResult): string {
    const lines: string[] = ["## Quality Gate Results", "", result.summary, ""];

    for (const check of result.checks) {
      const icon = check.passed ? "✅" : check.severity === "error" ? "❌" : "⚠️";
      lines.push(`${icon} **${check.name}**: ${check.message}`);
    }

    return lines.join("\n");
  }
}

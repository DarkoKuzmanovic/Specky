# Specky MVP Roadmap

> **Goal:** Bring Specky to a marketplace-ready MVP state with proper testing, polished assets, and validated functionality.

## Current State Summary

| Area                                                                | Status      |
| ------------------------------------------------------------------- | ----------- |
| Core Architecture                                                   | ✅ Complete |
| Chat Participant (@specky)                                          | ✅ Complete |
| 5 Slash Commands                                                    | ✅ Complete |
| Services (FileManager, ModelSelector, QualityGate, ProgressTracker) | ✅ Complete |
| Views (TreeProvider, StatusBar, Dashboard)                          | ✅ Complete |
| Tests                                                               | ❌ None     |
| Extension Icon                                                      | ❌ Missing  |
| Quality Gate/Prompt Alignment                                       | ❌ Mismatch |

| /implement QoL (dry-run, task select, run links) | ✅ Complete |

---

## Sprint 1: Critical Fixes

**Focus:** Fix blocking bugs that would cause user confusion or broken functionality.

- [ ] Fix quality gate section name mismatch in `src/services/qualityGate.ts`

  > Current `requiredSections` checks for `## Overview`, `## Requirements`, `## Acceptance Criteria`
  > But `src/chat/prompts.ts` generates `## Problem Statement`, `## Functional Requirements`, `## Success Criteria` > **Action:** Update `requiredSections` array to match actual prompt output headers

- [x] Update CHANGELOG.md release date

  > ✅ Completed: Updated versions to 0.1.x scheme (0.1.1)

- [ ] Verify `.vscodeignore` excludes dev artifacts

  > Ensure `src/`, `*.ts`, `node_modules/`, `.vscode/`, test files are excluded from VSIX

- [ ] Add `/implement` flag documentation to README
  > Include `--dry-run`, `--task`, and command links behavior

---

## Sprint 2: Test Suite

**Focus:** Add minimal test coverage for critical paths to ensure reliability.

### Test File Structure

```
src/test/
├── suite/
│   ├── index.ts          # Test runner entry
│   ├── fileManager.test.ts
│   ├── progressTracker.test.ts
│   └── qualityGate.test.ts
└── runTest.ts            # Test launcher
```

### Tasks

- [ ] Create test directory structure `src/test/suite/`

- [ ] Create `src/test/runTest.ts` - Test launcher

  > Use `@vscode/test-electron` to launch VS Code with extension loaded

- [ ] Create `src/test/suite/index.ts` - Test runner entry

  > Configure Mocha test runner, glob test files

- [ ] Create `src/test/suite/fileManager.test.ts`

  > Test cases:
  >
  > - `getFeatures()` returns empty array when no `.specky/` directory
  > - `createFeature()` creates numbered directory with spec.md
  > - `getActiveFeature()` returns most recently modified feature
  > - `toggleTask()` correctly toggles checkbox state

- [ ] Create `src/test/suite/progressTracker.test.ts`

  > Test cases:
  >
  > - `parseTasksFromContent()` parses simple checkbox list
  > - `parseTasksFromContent()` handles nested subtasks
  > - `parseTasksFromContent()` handles empty content
  > - `calculateProgress()` returns correct percentage
  > - `getNextTask()` returns first uncompleted task

- [ ] Create `src/test/suite/qualityGate.test.ts`

  > Test cases:
  >
  > - `runChecks()` returns error when spec.md missing
  > - `runChecks()` returns error when spec has TODO markers
  > - `runChecks()` returns warning for missing sections
  > - `runChecks()` passes with valid spec and plan

- [ ] Add test script to `package.json`

  > `"test": "vscode-test"`

- [ ] Verify tests run successfully with `npm test`

---

## Sprint 3: Polish & Assets

**Focus:** Professional appearance and offline reliability.

### Extension Icon

- [ ] Create extension icon (128x128 PNG)

  > Design: Spec document with checkmark or similar spec-driven theme
  > Save as `images/icon.png`

- [ ] Add icon path to `package.json`
  > `"icon": "images/icon.png"`

### Offline Icon Bundling

- [ ] Download Phosphor icons used in dashboard

  > Icons needed: `file-text`, `list-checks`, `check-circle`, `warning`, `x-circle`, `arrow-right`, `gear`, `question`
  > Save to `media/icons/` as SVG files

- [ ] Update `src/views/dashboard.ts` to use local icons

  > Replace CDN script tag with inline SVG sprites or local file references
  > Use `webview.asWebviewUri()` for proper resource loading

- [ ] Test dashboard works without internet connection

### Gallery Assets (Marketplace)

- [ ] Create banner image for marketplace (1280x640 or similar)

  > Save as `images/banner.png`

- [ ] Add gallery theme to `package.json`

  > ```json
  > "galleryBanner": {
  >   "color": "#1e1e1e",
  >   "theme": "dark"
  > }
  > ```

- [ ] Add screenshots for marketplace
  > Capture: Dashboard view, Chat interaction, Tree view
  > Save to `images/screenshots/`

---

## Sprint 4: Release Preparation

**Focus:** Final validation and marketplace submission.

### End-to-End Testing

- [ ] Test full workflow on fresh VS Code instance

  > 1. Install extension from VSIX
  > 2. Open empty workspace
  > 3. Run `/spec` → verify spec.md created
  > 4. Run `/clarify` → verify questions generated
  > 5. Run `/plan` → verify plan.md created
  > 6. Run `/tasks` → verify tasks.md created
  > 7. Run `/implement` → verify quality gate blocks without spec
  > 8. Toggle task checkboxes
  > 9. Verify dashboard updates

- [ ] Test without GitHub Copilot Chat installed

  > Verify graceful error message

- [ ] Test with no workspace open
  > Verify minimal commands registered, no crashes

### Pre-Publish Checklist

- [ ] Run `npm run lint` - no errors
- [ ] Run `npm run compile` - builds successfully
- [ ] Run `npm test` - all tests pass
- [ ] Package extension: `npx @vscode/vsce package`
- [ ] Verify VSIX size is reasonable (<5MB)
- [ ] Install VSIX locally and test
- [ ] Review `README.md` for accuracy
- [ ] Verify all links in README work
- [ ] Check `LICENSE` has correct year (2026) and author

### Marketplace Metadata

- [ ] Verify `package.json` has all required fields:

  > - `publisher` (must have VS Marketplace publisher account)
  > - `repository`
  > - `bugs`
  > - `homepage`
  > - `categories`
  > - `keywords`

- [ ] Add badges to README (optional)
  > VS Marketplace version, installs, rating

---

## Post-MVP Enhancements

> Ideas for future versions after initial marketplace release.

### v0.2 - Usability Improvements

- [ ] **Subtask nesting** - Support deeper task hierarchies in `progressTracker.ts`
- [ ] **Keyboard shortcuts** - Add keybindings for common actions
- [ ] **Quick Pick feature selector** - Faster feature switching
- [ ] **Template support** - Custom spec/plan templates per project

### v0.3 - Intelligence Features

- [ ] **Spec diff detection** - Warn when spec changes after plan is created
- [ ] **Automatic task suggestions** - AI-generated task breakdowns from plan
- [ ] **Implementation hints** - Contextual code suggestions during `/implement`
- [ ] **Cross-feature dependencies** - Track relationships between features

### v0.4 - Collaboration

- [ ] **Export to GitHub Issues** - Convert tasks.md to GitHub issues
- [ ] **Spec review workflow** - Request spec review before planning
- [ ] **Team settings sync** - Shared model preferences via `.specky/settings.json`

### v0.5 - Analytics & Insights

- [ ] **Telemetry** - Anonymous usage analytics (opt-in)
- [ ] **Time tracking** - Estimate vs actual time per feature
- [ ] **Velocity metrics** - Tasks completed per day/week
- [ ] **Quality score trends** - Track quality gate improvements

### Future Considerations

- [ ] **Localization** - Multi-language support
- [ ] **Theme integration** - Respect VS Code theme in dashboard
- [ ] **Custom quality gates** - User-defined validation rules
- [ ] **Offline LLM support** - Local model fallback when Copilot unavailable

---

## Notes

- All sprint tasks use `[ ]` checkmarks - mark as `[x]` when complete
- Add completion notes under tasks for code review context
- Blockers should be documented immediately when discovered

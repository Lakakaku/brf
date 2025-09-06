---
name: ui-healer
description: Analyze UI screens against style guide and fix design issues
---

# UI Healing System

This command analyzes UI screens against the project's style guide and UX rules, identifying and fixing design inconsistencies.

## Process

1. **Screenshot Analysis**: Take screenshots of specified screens using Playwright MCP
2. **Standards Review**: Load style-guide.md and ux-rules.md for evaluation criteria
3. **Objective Grading**: Score each screen 1-10 against design standards
4. **Issue Resolution**: Fix screens scoring <8/10 and re-evaluate

## Usage

Run `/ui-healer` followed by:

- URL or screen identifier to analyze
- Optional: specific components to focus on

The system will automatically iterate until all screens meet the 8/10 quality threshold.

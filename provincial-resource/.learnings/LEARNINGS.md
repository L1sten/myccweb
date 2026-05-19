# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260515-001] correction

**Logged**: 2026-05-15T15:51:43+0800
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
Embedded PRD markdown parsers must handle multi-level indented lists with a stack.

### Details
The PRD panel rendered indented bullets as literal `- ...` paragraphs because the list parser did not recognize nested list indentation. PRD content often uses three levels: module, rule type, and rule detail.

### Suggested Action
Use `ln.match(/^(\s*)- (.+)$/)` and a `<ul>` stack keyed by indentation depth for PRD markdown rendering; avoid single-level `inNestedUl` parsing and fragile regexes such as `\s{2 }- `.

### Metadata
- Source: user_feedback
- Related Files: index.html, /Users/chasenli/.agents/skills/myccweb-deploy/SKILL.md
- Tags: prd, markdown, nested-lists

---

# Errors

Command failures and integration errors.

---

## [ERR-20260519-001] browser_verification

**Logged**: 2026-05-19T10:40:00+0800
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
Initial verification commands failed due to tool usage and overlay layering issues.

### Details
`node -c index.html` cannot check HTML syntax. A Playwright one-liner also failed when shell expansion ate `$eval`. After switching to `page.evaluate`, browser verification exposed real UI issues: the auth key needed to be `ccweb_auth_provincial-resource`, the detail overlay needed a higher z-index than top controls, and the mobile PRD panel needed to default collapsed.

### Resolution
Raised the detail overlay z-index, collapsed the PRD panel by default on narrow screens, and reran desktop/mobile Playwright checks successfully.

### Metadata
- Source: error
- Related Files: index.html
- Tags: playwright, auth, z-index, responsive

---

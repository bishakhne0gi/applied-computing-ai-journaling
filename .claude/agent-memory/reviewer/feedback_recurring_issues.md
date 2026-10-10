---
name: recurring-review-issues
description: Recurring defect types seen in phase reviews of this repo; check for them first
metadata:
  type: feedback
---

- 2026-10-10 — Test doubles that also serve as the production demo path (FakeProvider) must not record calls/entry text unboundedly.
- 2026-10-10 — Check that `journal_ai` outcome field types match the spec's DB column types (e.g. raw_response is free text, so the column is text, not JSONB).
- 2026-10-10 — Error-detail sanitising via isinstance tuples silently drops sibling exception classes (ProviderTimeoutError not a ProviderError).
- 2026-10-10 — A service stores only the exception class name, then re-raises; the global 500 handler (logger.exception) and Sentry still record the full message. Check every re-raise path end to end.
- 2026-10-10 — Frontend Sentry: DOM click breadcrumbs serialise `aria-label`/`title` (htmlTreeAsString); any label built from entry text leaks it unless breadcrumbs are scrubbed.
- 2026-10-10 — TanStack setQueryData after a mutation without cancelQueries can be overwritten by an in-flight refetch (focus refetch during long AI calls).

**Why:** found in the P1 checkpoint review; each one is easy to repeat in later phases.
**How to apply:** grep for these patterns in every phase review before reading anything else.

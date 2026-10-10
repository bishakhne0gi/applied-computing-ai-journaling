# journal_ai rules

- Pure package: text + language in, `AnalysisOutcome` out. No database, HTTP framework or backend imports.
- Providers implement `CompletionProvider`; the `FakeProvider` covers every failure mode in tests.
- Parsing raises only when the top-level output is unusable; a single bad mistake is dropped and counted.
- Changing prompt text → bump `PROMPT_VERSION` and run `make eval`.

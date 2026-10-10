---
paths:
  - "ai/**"
---
# journal_ai rules
- Provider-agnostic core: prompts, parsing, alignment and the analyzer never import a provider SDK; only `providers/anthropic.py` does.
- The entry is data: always wrapped in `<entry>` delimiters and stripped of delimiter look-alikes.
- Offsets are Unicode code-point indices into NFC-normalised text; highlights never overlap.
- Prompt changes bump `PROMPT_VERSION`; record eval results in the commit body.

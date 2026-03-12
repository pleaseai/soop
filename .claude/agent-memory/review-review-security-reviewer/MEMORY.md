# Security Reviewer - Project Memory

## Project Security Conventions
- API keys sourced from environment variables: `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- Key env var was renamed `GOOGLE_API_KEY` -> `GOOGLE_GENERATIVE_AI_API_KEY` in PR feat/gemini-3.1-flash-lite-default
- API keys are NEVER logged — confirmed across llm.ts, semantic.ts, encoder.ts
- Default LLM provider is now `google` (gemini-3.1-flash-lite-preview)

## Stale References Found (PR feat/gemini-3.1-flash-lite-default)
- `packages/encoder/tests/encoder.test.ts:410` — `Reflect.deleteProperty(process.env, 'GOOGLE_API_KEY')` (OLD name, should be `GOOGLE_GENERATIVE_AI_API_KEY`)
- `.claude/agent-memory/review-review-silent-failure-hunter/MEMORY.md:14,18,22` — stale notes referencing `GOOGLE_API_KEY` (agent memory, not production code)
- `.please/plans/*.md` — plan docs still reference `GOOGLE_API_KEY` (non-production, documentation)

## Key Security Patterns
- `createProvider()` in llm.ts: API key passed to SDK constructors, not stored in logs
- `SemanticExtractor` constructor: eager key check for google provider — falls back to heuristic with `log.warn` (no key value in log message)
- `CallOptions.headers`: passed through to Vercel AI SDK `generateText()` — no sanitization, callers must ensure no secrets in headers at debug log level
- CI workflows: secrets referenced via `${{ secrets.* }}` (correct pattern, not hardcoded)
- `permissionMode: 'bypassPermissions'` in claude-code provider is a hardcoded default for automated use

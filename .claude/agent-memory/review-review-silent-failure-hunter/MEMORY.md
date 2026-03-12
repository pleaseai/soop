# Silent Failure Hunter - Project Memory

## Project Conventions
- Logging: `createLogger('Tag')` from `@pleaseai/soop-utils/logger` (consola-based)
- Log levels: `log.error` (Sentry-level), `log.warn`, `log.info`, `log.debug`
- No `errorIds.ts` / Sentry error ID system in this project (consola only, no structured error IDs)
- MCP server uses `createStderrLogger` (stdout reserved for JSON-RPC)

## Key Error Handling Patterns Confirmed

### LLMClient (packages/utils/src/llm.ts)
- `callGenerateText` / `callGenerateTextWithMessages`: catch blocks log + re-throw — NOT silent
- `generate()` retry loop: swallows errors silently when retries < maxRetries (no log on intermediate retry failures)
- `createProvider()` for `google`: passes `apiKey ?? process.env.GOOGLE_API_KEY` — undefined key deferred to SDK at call time (no eager validation)
- `buildProviderOptions()`: returns `undefined` silently when provider is NOT google but googleSettings is set — user gets no warning

### SemanticExtractor (packages/encoder/src/semantic.ts)
- Default `provider: 'google'` added in this PR — when GOOGLE_API_KEY is absent and no explicit provider set, `useLLM=true` creates an LLMClient with an empty key; failure is deferred to first API call
- `extract()` fallback: after maxIterations, falls back to heuristic with `log.warn` — not silent, but degraded silently for the user if they didn't enable verbose

### RPGEncoder (packages/encoder/src/encoder.ts)
- `createLLMClient()`: detects provider from env vars; with default google in SemanticExtractor, the encoder-level detection (GOOGLE_API_KEY check) will still find no key if unset and return null — but SemanticExtractor constructor always passes an explicit `provider: 'google'` now, bypassing this null path

## Issues Found in PR feat/gemini-3.1-flash-lite-default
See patterns.md for detailed findings

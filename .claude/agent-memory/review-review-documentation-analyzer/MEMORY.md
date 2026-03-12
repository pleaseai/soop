# Documentation Analyzer Memory

## Project Conventions

- Documentation lives in `/home/coder/IdeaProjects/rpg/CLAUDE.md` (internal) and `README.md` / `packages/soop/README.md` (public, identical content)
- LLM provider config is in `packages/utils/src/llm.ts` (`DEFAULT_MODELS`, `MODEL_PRICING`, `createProvider`)
- SemanticExtractor defaults are in `packages/encoder/src/semantic.ts` constructor

## Known Issues Found (PR #169)

- `packages/encoder/tests/encoder.test.ts:410`: Cleanup block deletes `GOOGLE_API_KEY` instead of `GOOGLE_GENERATIVE_AI_API_KEY` — stale env var name in test teardown
- `.please/plans/2026-02-06-domain-discovery-3level-path.md:204,301`: Still references old `GOOGLE_API_KEY` in error message strings — plan doc not updated
- `packages/utils/src/llm.ts:282`: JSDoc example uses `claude-3-5-haiku-latest` (old model ID) rather than current `claude-haiku-4.5`
- `CLAUDE.md:403`: Performance column claims Gemini 3.1 Flash-Lite is "Best" — subjective/unverified claim; no SWE-bench data provided unlike other rows

## Key Facts

- Correct Google env var: `GOOGLE_GENERATIVE_AI_API_KEY` (set in `llm.ts:176`)
- Google default model: `gemini-3.1-flash-lite-preview` (set in `DEFAULT_MODELS`)
- Gemini pricing confirmed: `{ input: 0.25, output: 1.50 }` per 1M tokens (matches docs)
- SemanticExtractor defaults: `provider: 'google'`, `maxTokens: 8192`, `googleSettings: { thinkingConfig: { thinkingLevel: 'minimal' } }`
- LLMClient default `maxTokens`: 32768 (not in docs — intentionally undocumented at present)
- `CallOptions` interface is documented inline in `llm.ts` with JSDoc but not mentioned in CLAUDE.md

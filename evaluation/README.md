# soop Agent Evaluation

Agent evaluation framework for measuring how soop MCP tools improve AI coding agent performance on SWE-bench tasks.

## Overview

Uses [@vercel/agent-eval](https://github.com/vercel/agent-eval) to run AI coding agents (Claude Code, Codex CLI, Gemini CLI) inside Docker sandboxes against SWE-bench Verified instances. Each experiment compares a **baseline** (agent alone) against **soop-augmented** (agent + soop MCP semantic search).

## Structure

```
evaluation/
├── experiments/           # Experiment configurations
│   ├── baseline-claude-code.ts   # Claude Code without soop
│   ├── baseline-gemini.ts        # Gemini CLI without soop
│   ├── soop-claude-code.ts       # Claude Code + soop MCP
│   ├── soop-codex.ts             # Codex CLI + soop MCP
│   └── soop-gemini.ts            # Gemini CLI + soop MCP
├── evals/swe-bench/       # Eval fixtures (one dir per SWE-bench instance)
│   ├── django-14170/
│   │   ├── PROMPT.md      # Problem statement for the agent
│   │   ├── EVAL.ts        # Vitest assertions (file recall, tool call count)
│   │   └── package.json   # Fixture dependencies
│   └── xarray-6938/
├── lib/                   # Shared libraries
│   ├── metrics.ts         # Precision/recall/F1 + oracle file extraction
│   ├── setup-soop.ts      # Sandbox setup: install soop, encode repo, configure MCP
│   └── swe-bench-loader.ts # Load SWE-bench dataset from vendor submodule
├── scripts/
│   └── generate-evals.ts  # Generate eval fixtures from SWE-bench dataset
└── package.json
```

## Quick Start

```bash
cd evaluation
npm install

# Generate eval fixtures from SWE-bench dataset
npm run generate

# Run soop + Claude Code experiment
npm run eval:soop

# Run baseline Claude Code experiment
npm run eval:baseline

# Run soop + Codex CLI experiment
npm run eval:codex

# Run a specific experiment file
npx agent-eval run experiments/soop-gemini.ts

# Run a single eval
npx agent-eval run experiments/soop-claude-code.ts --evals django-14170
```

## Experiments

Each experiment config defines agent type, model, sandbox, and optional setup function.

| Experiment | Agent | Model | soop |
|---|---|---|---|
| `baseline-claude-code` | Claude Code | sonnet | No |
| `soop-claude-code` | Claude Code | sonnet | Yes |
| `soop-codex` | Codex CLI | gpt-5.2-codex | Yes |
| `baseline-gemini` | Gemini CLI | gemini-3-flash-preview | No |
| `soop-gemini` | Gemini CLI | gemini-3-flash-preview | Yes |

### soop Setup

The `setupSoop` function (`lib/setup-soop.ts`) runs inside the Docker sandbox before the agent starts:

1. Installs `@pleaseai/soop` globally
2. Configures Claude Code MCP settings (`.claude/settings.json`)
3. Runs `soop init` + `soop encode` with local embedding model (`voyage-4-nano`)

## Eval Fixtures

Each fixture contains:

- **PROMPT.md** — Problem statement from SWE-bench, given to the agent as its task
- **EVAL.ts** — Vitest test file that runs after the agent finishes:
  - Checks file recall (did the agent edit the correct files?)
  - Checks tool call efficiency (< 50 total tool calls)
- **package.json** — Fixture-level dependencies

### Generating Fixtures

Fixtures are generated from the curated SWE-bench Verified subset (30 instances, 15min-1h difficulty, ≤2 files):

```bash
# Generate all fixtures
npm run generate

# Generate first 5 only
npx tsx scripts/generate-evals.ts --max 5

# Generate a specific instance
npx tsx scripts/generate-evals.ts --id django__django-14170
```

Source dataset: `vendor/context-please/evaluation/swe_verified_15min1h_2files_instances.json`

## Metrics

`lib/metrics.ts` provides:

- **`extractOracleFiles(patch)`** — Extracts ground-truth file paths from unified diff patches (both `--- a/` and `+++ b/` sides for added, modified, and deleted files)
- **`calculateMetrics(hits, oracles)`** — Precision, recall, and F1 score for file retrieval
- **`loadResults(basePath)`** — Loads agent-eval transcript summary (`__agent_eval__/results.json`)

## Environment Variables

| Variable | Required By | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude Code experiments | Anthropic API key |
| `OPENAI_API_KEY` | Codex experiments | OpenAI API key |
| `GOOGLE_API_KEY` | Gemini experiments | Google AI API key |

## Requirements

- Docker (for sandbox isolation)
- Node.js 18+
- Git submodules initialized (`git submodule update --init`)

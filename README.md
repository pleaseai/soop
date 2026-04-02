# soop please: Repository Planning Graph

A unified framework for repository understanding and generation based on the Repository Planning Graph (RPG) representation.

[![codecov](https://codecov.io/gh/pleaseai/soop/graph/badge.svg?token=PfprF4qUBw)](https://codecov.io/gh/pleaseai/soop)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=pleaseai_soop&metric=alert_status&token=689e64c38ea80939aaaa4089f723cfc1f879d9c1)](https://sonarcloud.io/summary/new_code?id=pleaseai_soop)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=pleaseai_soop&metric=security_rating&token=689e64c38ea80939aaaa4089f723cfc1f879d9c1)](https://sonarcloud.io/summary/new_code?id=pleaseai_soop)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=pleaseai_soop&metric=vulnerabilities&token=689e64c38ea80939aaaa4089f723cfc1f879d9c1)](https://sonarcloud.io/summary/new_code?id=pleaseai_soop)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=pleaseai_soop&metric=bugs&token=689e64c38ea80939aaaa4089f723cfc1f879d9c1)](https://sonarcloud.io/summary/new_code?id=pleaseai_soop)

## Overview

This project implements the concepts from two research papers:

1. **RPG-ZeroRepo** ([arXiv:2509.16198](https://arxiv.org/abs/2509.16198)) - Repository generation from scratch using structured planning graphs
2. **RPG-Encoder** ([arXiv:2602.02084](https://arxiv.org/abs/2602.02084)) - Encoding existing repositories into RPG for understanding and navigation

### Key Insight

Repository comprehension and generation are inverse processes within a unified reasoning cycle:
- **Generation**: Expands intent into implementation (Intent → Code)
- **Comprehension**: Compresses implementation back into intent (Code → Intent)

RPG serves as a **unified intermediate representation** that bridges both directions.

## Architecture

### Repository Planning Graph (RPG) Structure

RPG is a hierarchical, dual-view graph `G = (V, E)`:

```
                    ┌─────────────────────────────────────────┐
                    │           Repository Planning Graph      │
                    └─────────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
              ┌─────▼─────┐                         ┌───────▼──────┐
              │  Nodes (V) │                         │  Edges (E)   │
              └─────┬─────┘                         └───────┬──────┘
                    │                                       │
        ┌───────────┴───────────┐               ┌───────────┴───────────┐
        │                       │               │                       │
  ┌─────▼─────┐          ┌──────▼─────┐   ┌─────▼─────┐          ┌──────▼─────┐
  │ High-level │          │ Low-level  │   │ Functional │          │ Dependency │
  │   Nodes    │          │   Nodes    │   │   Edges    │          │   Edges    │
  │  (V_H)     │          │   (V_L)    │   │ (E_feature)│          │  (E_dep)   │
  └────────────┘          └────────────┘   └────────────┘          └────────────┘
        │                       │                 │                       │
  Architectural           Atomic            Teleological            Logical
  directories          implementations        hierarchy           interactions
                      (files, classes,                           (imports, calls)
                       functions)
```

### Node Structure

Each node `v = (f, m)` contains:
- **f (Semantic Feature)**: Describes functionality (e.g., "handles authentication")
- **m (Structural Metadata)**: Code entity attributes (type, path, etc.)

### Dual-View Edges

1. **Functional Edges (E_feature)**: Parent-child relationships establishing feature hierarchy
2. **Dependency Edges (E_dep)**: Import/call relationships mapping execution logic

## Components

### 1. RPG-ZeroRepo: Repository Generation

Generate repositories from high-level specifications through three stages:

| Stage | Description |
|-------|-------------|
| **A. Proposal-Level** | Feature Tree → Explore-Exploit Selection → Goal-Aligned Refactoring |
| **B. Implementation-Level** | File Structure → Data Flow → Interface Design |
| **C. Code Generation** | Topological Traversal → TDD → Validation Pipeline |

### 2. RPG-Encoder: Repository Understanding

Extract RPG from existing codebases through three mechanisms:

| Mechanism | Description |
|-----------|-------------|
| **Encoding** | Semantic Lifting → Structural Reorganization → Artifact Grounding |
| **Evolution** | Commit-Level Incremental Updates (Add/Modify/Delete) |
| **Operation** | SearchNode, FetchNode, ExploreRPG Tools |

## Installation

```bash
# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Clone and install
git clone https://github.com/pleaseai/soop.git
cd soop
bun install
```

## Quick Start

### Repository Generation (ZeroRepo)

```typescript
import { ZeroRepo } from '@pleaseai/soop'

// Initialize with repository specification
const zerorepo = new ZeroRepo({
  spec: `A machine learning library with data preprocessing,
         algorithms (regression, classification, clustering),
         and evaluation metrics.`
})

// Stage A: Build functionality graph
const funcGraph = await zerorepo.buildProposalGraph()

// Stage B: Add implementation details
const rpg = await zerorepo.buildImplementationGraph(funcGraph)

// Stage C: Generate code
await zerorepo.generateRepository(rpg, './generated_repo')
```

### Repository Understanding (Encoder)

```typescript
import { RPGEncoder, SearchNode, FetchNode, ExploreRPG } from '@pleaseai/soop'

// Encode existing repository
const encoder = new RPGEncoder('./my_project')
const rpg = await encoder.encode()

// Use agentic tools for navigation
const search = new SearchNode(rpg)
const results = await search.query({
  mode: 'features',
  featureTerms: ['handle authentication', 'validate token']
})

// Fetch detailed information
const fetch = new FetchNode(rpg)
const details = await fetch.get({
  codeEntities: ['auth/login.ts:LoginHandler']
})

// Explore dependencies
const explore = new ExploreRPG(rpg)
const deps = await explore.traverse({
  startNode: 'auth/login.ts:LoginHandler',
  edgeType: 'dependency'
})
```

### Incremental Updates

```typescript
// Update RPG with new commits
await encoder.evolve({ commitRange: 'HEAD~5..HEAD' })
```

### CLI Usage

```bash
# Encode a repository
soop encode ./my_project -o repo.json

# Encode with a specific LLM provider/model
soop encode ./my_project -m google                    # Google Gemini (default model)
soop encode ./my_project -m openai/gpt-5.2            # OpenAI with specific model
soop encode ./my_project -m anthropic/claude-haiku-4.5 # Anthropic Haiku
soop encode ./my_project -m claude-code/haiku          # Claude Code (no API key needed)
soop encode ./my_project --no-llm                      # Heuristic only (no LLM)

# Generate from specification
soop generate --spec "A REST API for user management" -o ./output

# Search in RPG
soop search --graph graph.json --term "authentication"

# Evolve with commits (also supports -m/--model)
soop evolve --graph graph.json --commits HEAD~5..HEAD
soop evolve --graph graph.json -m google --commits HEAD~5..HEAD
```

#### Model Configuration

The `-m, --model` option uses `provider/model` format. If the model is omitted, a default is used.

| Provider | Format | Default Model | API Key Env Var |
|----------|--------|---------------|-----------------|
| `openai` | `openai/gpt-5.2` | `gpt-4o` | `OPENAI_API_KEY` |
| `anthropic` | `anthropic/claude-haiku-4.5` | `claude-sonnet-4.5` | `ANTHROPIC_API_KEY` |
| `google` | `google/gemini-3-pro-preview` | `gemini-3.1-flash-lite-preview` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `claude-code` | `claude-code/haiku` | `sonnet` | Not required (uses subscription) |

## Project Structure

```
soop/                              # Private monorepo root (not published)
├── packages/
│   ├── soop/                      # Published package: @pleaseai/soop
│   │   ├── src/index.ts           # Main exports (re-exports all workspace packages)
│   │   ├── bin/soop               # CLI binary
│   │   ├── bin/soop-mcp           # MCP server shim (deprecated, use `soop mcp`)
│   │   └── package.json
│   │
│   ├── ast/      # @pleaseai/soop-ast     — WASM tree-sitter parser (multi-language)
│   ├── utils/    # @pleaseai/soop-utils   — LLM, git helpers, logger
│   ├── store/    # @pleaseai/soop-store   — Storage interfaces & implementations
│   ├── graph/    # @pleaseai/soop-graph   — RPG data structures
│   ├── encoder/  # @pleaseai/soop-encoder — Code → RPG extraction
│   ├── tools/    # @pleaseai/soop-tools   — Agentic navigation tools
│   ├── zerorepo/ # @pleaseai/soop-zerorepo — Intent → Code generation
│   ├── namu/     # @pleaseai/soop-namu   — WASM grammar asset management
│   ├── mcp/      # @pleaseai/soop-mcp    — MCP server
│   ├── cli/      # @pleaseai/soop-cli    — CLI entry point
│   └── soop-native/ # native binary distribution (bun compiled)
│
├── tests/
│   └── fixtures/                  # Shared test fixtures (sample-rpg.json, superjson)
├── docs/
├── scripts/
├── package.json                   # Monorepo root (private, version 0.0.0)
└── README.md
```

## Benchmarks

### Repository Understanding (SWE-bench)

| Method | SWE-bench Verified (Acc@5) | SWE-bench Live Lite |
|--------|---------------------------|---------------------|
| API Documentation | 82.1% | - |
| Dependency Graph | 79.3% | - |
| **RPG-Encoder** | **93.7%** | **+10%** over best baseline |

### Repository Generation (RepoCraft)

| Method | Code Lines | Coverage | Test Accuracy |
|--------|-----------|----------|---------------|
| Claude Code | ~9.2K | 54.2% | 33.9% |
| Other Baselines | ~530 | ~15% | ~10% |
| **ZeroRepo** | **~36K** | **81.5%** | **69.7%** |

## Requirements

- Bun 1.0+
- LLM provider access (choose one):
  - OpenAI, Anthropic, or Google API key (for API-based providers)
  - Claude Desktop with Pro/Max subscription (for Claude Code provider, no API key needed)

## Citation

```bibtex
@article{luo2025rpg,
  title={RPG: A Repository Planning Graph for Unified and Scalable Codebase Generation},
  author={Luo, Jane and Zhang, Xin and Liu, Steven and Wu, Jie and others},
  journal={arXiv preprint arXiv:2509.16198},
  year={2025}
}

@article{luo2025rpgencoder,
  title={Closing the Loop: Universal Repository Representation with RPG-Encoder},
  author={Luo, Jane and Yin, Chengyu and Zhang, Xin and others},
  journal={arXiv preprint arXiv:2602.02084},
  year={2025}
}
```

## License

MIT License

## Documentation

- [Implementation Status](docs/implementation-status.md) — Paper vs implementation gap analysis (implemented / not implemented / needs modification)
- [RPG Operation](docs/rpg-operation.md) — SearchNode, FetchNode, ExploreRPG tools reference and canonical orchestration patterns
- [Vendor Comparison](docs/vendor-comparison.md) — Microsoft Python reference vs TypeScript implementation technical differences

## Related Projects

- [RepoGraph](https://github.com/ozyyshr/RepoGraph) ([arXiv:2410.14684](https://arxiv.org/abs/2410.14684)) — Repository-level code graph module for AI software engineering (ICLR 2025); constructs dependency and reference graphs to provide LLMs with repository-wide navigation context, achieving state-of-the-art on SWE-bench among open-source frameworks
- [Beads](https://github.com/steveyegge/beads) — Distributed, git-backed task tracking system for AI coding agents; provides persistent structured memory and dependency-aware task graphs for long-horizon agent workflows

## Acknowledgments

This implementation is based on research from Microsoft Research Asia.

- [RPG-ZeroRepo Paper](https://arxiv.org/abs/2509.16198)
- [RPG-Encoder Paper](https://arxiv.org/abs/2602.02084)
- [Project Page](https://ayanami2003.github.io/RPG-Encoder/)
- [Original Code](https://github.com/microsoft/RPG-ZeroRepo)

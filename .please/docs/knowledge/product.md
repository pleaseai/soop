# Product Guide: soop please

## Vision

soop please is a TypeScript/Bun implementation of the Repository Planning Graph (RPG) — a hierarchical dual-view graph that combines semantic features with structural metadata for repository understanding and generation.

## Problem Statement

Developers and AI agents lack structured, semantic understanding of codebases. Traditional tools rely on text search and file paths, missing the higher-level architectural intent behind code. soop please bridges this gap by encoding repositories into navigable semantic graphs.

## Core Capabilities

1. **RPG-Encoder** (Code to Intent): Extracts semantic meaning from existing repositories into a structured graph representation — enabling AI-powered code understanding, search, and navigation.
2. **RPG-ZeroRepo** (Intent to Code): Generates repository code from specifications using the RPG structure — enabling intent-driven code generation with architectural consistency.
3. **MCP Server**: Provides Claude Code integration via Model Context Protocol, exposing graph search, fetch, explore, encode, and evolve tools.

## Target Users

- **AI coding agents** (Claude Code, Codex CLI) that need structured codebase understanding
- **Development teams** seeking semantic code search and architectural insight
- **CI/CD pipelines** that maintain up-to-date repository graphs automatically

## Key Differentiators

- Hierarchical dual-view graph (semantic features + structural metadata)
- Incremental evolution via commit-level updates
- Two-tier data management (CI canonical + local branch-aware)
- Zero-dependency local mode with optional high-performance backends
- Paper-based implementation (RPG-ZeroRepo & RPG-Encoder research papers)

# Changelog

## [0.1.4](https://github.com/pleaseai/soop/compare/soop-cli-v0.1.3...soop-cli-v0.1.4) (2026-02-25)


### Features

* **cli:** add two-tier RPG data management (CI + local) ([#71](https://github.com/pleaseai/soop/issues/71)) ([2b00bdf](https://github.com/pleaseai/soop/commit/2b00bdf2a6489d6f1224ab344f7cd8d649ce2d8a))
* **encoder:** add git-managed vector embeddings with Float16 codec ([#74](https://github.com/pleaseai/soop/issues/74)) ([d3fdb4d](https://github.com/pleaseai/soop/commit/d3fdb4d0499b1e0aaa17cb94ad1ed6bcc9b4e4c5))
* **encoder:** implement token-aware batch semantic extraction ([#82](https://github.com/pleaseai/soop/issues/82)) ([b1f8ad2](https://github.com/pleaseai/soop/commit/b1f8ad25b5d8ccad3940eca2c4014c2ce33e7237))
* rebrand from rpg to repo please with monorepo restructure ([#117](https://github.com/pleaseai/soop/issues/117)) ([d4b805a](https://github.com/pleaseai/soop/commit/d4b805abc23f20e8ac3fe1b375c105ba7a6c9b33))
* **utils:** add claude-code LLM provider ([#66](https://github.com/pleaseai/soop/issues/66)) ([00d8ce2](https://github.com/pleaseai/soop/commit/00d8ce2165c568e41ca0cf890e2d328c450fbe25))
* **utils:** add Codex CLI LLM provider ([#73](https://github.com/pleaseai/soop/issues/73)) ([de76959](https://github.com/pleaseai/soop/commit/de76959321b351eb8b760252cc9804473de0dd89))


### Bug Fixes

* **build:** resolve Bun compile errors for cross-platform binary distribution ([#114](https://github.com/pleaseai/soop/issues/114)) ([1f9ce01](https://github.com/pleaseai/soop/commit/1f9ce01e67825b2019733f6c28cdfe984a4379d6))
* **publish:** bundle workspace packages inline, fix sync vector store, and enable npm provenance ([#96](https://github.com/pleaseai/soop/issues/96)) ([b73033a](https://github.com/pleaseai/soop/commit/b73033a964942e83053fb9a6cf435bb3b7d7bdff))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @pleaseai/soop-encoder bumped to 0.1.4
    * @pleaseai/soop-graph bumped to 0.1.4
    * @pleaseai/soop-store bumped to 0.1.4
    * @pleaseai/soop-tools bumped to 0.1.4
    * @pleaseai/soop-utils bumped to 0.1.4
    * @pleaseai/soop-zerorepo bumped to 0.1.4

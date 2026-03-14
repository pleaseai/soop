# Changelog

## [0.2.0](https://github.com/pleaseai/soop/compare/soop-cli-v0.1.11...soop-cli-v0.2.0) (2026-03-14)


### ⚠ BREAKING CHANGES

* **encoder:** evolve CLI interface changed — requires <repo-path> positional arg, --graph option renamed to -l/--load-path, --stamp flag removed (auto-applied in save()).

### Features

* **store:** add BM25 scoring to LocalTextSearchStore ([#233](https://github.com/pleaseai/soop/issues/233)) ([d04445d](https://github.com/pleaseai/soop/commit/d04445dc81f19e12e7086d6fdb0c6ac48a918195))


### Code Refactoring

* **encoder:** align RPGEncoder API and CLI with reference implementation ([#231](https://github.com/pleaseai/soop/issues/231)) ([9a2a89a](https://github.com/pleaseai/soop/commit/9a2a89a464b265caf951fc54cbe4879d5933d52c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @pleaseai/soop-encoder bumped to 0.2.0
    * @pleaseai/soop-graph bumped to 0.1.9
    * @pleaseai/soop-mcp bumped to 0.2.0
    * @pleaseai/soop-store bumped to 0.1.8
    * @pleaseai/soop-tools bumped to 0.1.11
    * @pleaseai/soop-utils bumped to 0.1.8
    * @pleaseai/soop-zerorepo bumped to 0.1.9

## [0.1.11](https://github.com/pleaseai/soop/compare/soop-cli-v0.1.10...soop-cli-v0.1.11) (2026-03-14)


### Features

* **cli:** integrate soop-mcp into soop mcp subcommand ([#228](https://github.com/pleaseai/soop/issues/228)) ([8dd7426](https://github.com/pleaseai/soop/commit/8dd74266ce1ca0065a5da91719e1dcb79903f897))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @pleaseai/soop-mcp bumped to 0.1.12

## [0.1.10](https://github.com/pleaseai/soop/compare/soop-cli-v0.1.9...soop-cli-v0.1.10) (2026-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @pleaseai/soop-encoder bumped to 0.1.10
    * @pleaseai/soop-tools bumped to 0.1.10

## [0.1.9](https://github.com/pleaseai/soop/compare/soop-cli-v0.1.8...soop-cli-v0.1.9) (2026-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @pleaseai/soop-encoder bumped to 0.1.9
    * @pleaseai/soop-tools bumped to 0.1.9

## [0.1.8](https://github.com/pleaseai/soop/compare/soop-cli-v0.1.7...soop-cli-v0.1.8) (2026-03-12)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @pleaseai/soop-encoder bumped to 0.1.8
    * @pleaseai/soop-graph bumped to 0.1.8
    * @pleaseai/soop-store bumped to 0.1.7
    * @pleaseai/soop-tools bumped to 0.1.8
    * @pleaseai/soop-zerorepo bumped to 0.1.8

## [0.1.7](https://github.com/pleaseai/soop/compare/soop-cli-v0.1.6...soop-cli-v0.1.7) (2026-03-12)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @pleaseai/soop-encoder bumped to 0.1.7
    * @pleaseai/soop-graph bumped to 0.1.7
    * @pleaseai/soop-tools bumped to 0.1.7
    * @pleaseai/soop-utils bumped to 0.1.7
    * @pleaseai/soop-zerorepo bumped to 0.1.7

## [0.1.6](https://github.com/pleaseai/soop/compare/soop-cli-v0.1.5...soop-cli-v0.1.6) (2026-03-09)


### Features

* **cli:** add two-tier RPG data management (CI + local) ([#71](https://github.com/pleaseai/soop/issues/71)) ([2b00bdf](https://github.com/pleaseai/soop/commit/2b00bdf2a6489d6f1224ab344f7cd8d649ce2d8a))
* **encoder:** add git-managed vector embeddings with Float16 codec ([#74](https://github.com/pleaseai/soop/issues/74)) ([d3fdb4d](https://github.com/pleaseai/soop/commit/d3fdb4d0499b1e0aaa17cb94ad1ed6bcc9b4e4c5))
* **encoder:** change default LLM provider to google/gemini-3.1-flash-lite-preview ([#169](https://github.com/pleaseai/soop/issues/169)) ([88e833c](https://github.com/pleaseai/soop/commit/88e833c684b7749a2915a09e5920ba3baf38c1ea))
* **encoder:** implement token-aware batch semantic extraction ([#82](https://github.com/pleaseai/soop/issues/82)) ([b1f8ad2](https://github.com/pleaseai/soop/commit/b1f8ad25b5d8ccad3940eca2c4014c2ce33e7237))
* **encoder:** support flexible 2-5 level hierarchy and evolution area creation ([#155](https://github.com/pleaseai/soop/issues/155)) ([7e12b26](https://github.com/pleaseai/soop/commit/7e12b268f7cf5357435eddcc443425a08831ee13))
* rebrand from rpg to repo please with monorepo restructure ([#117](https://github.com/pleaseai/soop/issues/117)) ([d4b805a](https://github.com/pleaseai/soop/commit/d4b805abc23f20e8ac3fe1b375c105ba7a6c9b33))
* **utils:** add claude-code LLM provider ([#66](https://github.com/pleaseai/soop/issues/66)) ([00d8ce2](https://github.com/pleaseai/soop/commit/00d8ce2165c568e41ca0cf890e2d328c450fbe25))
* **utils:** add Codex CLI LLM provider ([#73](https://github.com/pleaseai/soop/issues/73)) ([de76959](https://github.com/pleaseai/soop/commit/de76959321b351eb8b760252cc9804473de0dd89))


### Bug Fixes

* **build:** resolve Bun compile errors for cross-platform binary distribution ([#114](https://github.com/pleaseai/soop/issues/114)) ([1f9ce01](https://github.com/pleaseai/soop/commit/1f9ce01e67825b2019733f6c28cdfe984a4379d6))
* **publish:** bundle workspace packages inline, fix sync vector store, and enable npm provenance ([#96](https://github.com/pleaseai/soop/issues/96)) ([b73033a](https://github.com/pleaseai/soop/commit/b73033a964942e83053fb9a6cf435bb3b7d7bdff))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @pleaseai/soop-encoder bumped to 0.1.6
    * @pleaseai/soop-graph bumped to 0.1.6
    * @pleaseai/soop-store bumped to 0.1.6
    * @pleaseai/soop-tools bumped to 0.1.6
    * @pleaseai/soop-utils bumped to 0.1.6
    * @pleaseai/soop-zerorepo bumped to 0.1.6

## [0.1.5](https://github.com/pleaseai/soop/compare/soop-cli-v0.1.4...soop-cli-v0.1.5) (2026-03-09)


### Features

* **encoder:** change default LLM provider to google/gemini-3.1-flash-lite-preview ([#169](https://github.com/pleaseai/soop/issues/169)) ([88e833c](https://github.com/pleaseai/soop/commit/88e833c684b7749a2915a09e5920ba3baf38c1ea))
* **encoder:** support flexible 2-5 level hierarchy and evolution area creation ([#155](https://github.com/pleaseai/soop/issues/155)) ([7e12b26](https://github.com/pleaseai/soop/commit/7e12b268f7cf5357435eddcc443425a08831ee13))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @pleaseai/soop-encoder bumped to 0.1.5
    * @pleaseai/soop-graph bumped to 0.1.5
    * @pleaseai/soop-store bumped to 0.1.5
    * @pleaseai/soop-tools bumped to 0.1.5
    * @pleaseai/soop-utils bumped to 0.1.5
    * @pleaseai/soop-zerorepo bumped to 0.1.5

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

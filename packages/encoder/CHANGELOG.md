# Changelog

## [0.1.4](https://github.com/pleaseai/soop/compare/soop-encoder-v0.1.3...soop-encoder-v0.1.4) (2026-02-25)


### Features

* **ast:** add C#, C/C++, Ruby, Kotlin language support and upgrade tree-sitter ([#107](https://github.com/pleaseai/soop/issues/107)) ([4be235a](https://github.com/pleaseai/soop/commit/4be235a9727ba4400573a82bfa6dd124466dbaae))
* **encoder:** achieve full parity with Python reference encoder ([#105](https://github.com/pleaseai/soop/issues/105)) ([812e16e](https://github.com/pleaseai/soop/commit/812e16ee4661eb3d597635d93f49ac093df25801))
* **encoder:** add git-managed vector embeddings with Float16 codec ([#74](https://github.com/pleaseai/soop/issues/74)) ([d3fdb4d](https://github.com/pleaseai/soop/commit/d3fdb4d0499b1e0aaa17cb94ad1ed6bcc9b4e4c5))
* **encoder:** implement DependencyGraph with invocation and inheritance tracking ([#83](https://github.com/pleaseai/soop/issues/83)) ([3e21441](https://github.com/pleaseai/soop/commit/3e21441e8f4301886886997381573030eae85603))
* **encoder:** implement token-aware batch semantic extraction ([#82](https://github.com/pleaseai/soop/issues/82)) ([b1f8ad2](https://github.com/pleaseai/soop/commit/b1f8ad25b5d8ccad3940eca2c4014c2ce33e7237))
* **encoder:** implement type-aware call resolution in DependencyGraph ([#90](https://github.com/pleaseai/soop/issues/90)) ([5da75f7](https://github.com/pleaseai/soop/commit/5da75f74a23c91d87aaff29d9d10a066b2ea2bf7))
* rebrand from rpg to repo please with monorepo restructure ([#117](https://github.com/pleaseai/soop/issues/117)) ([d4b805a](https://github.com/pleaseai/soop/commit/d4b805abc23f20e8ac3fe1b375c105ba7a6c9b33))
* **store:** add zero-dependency local fallback stores and make native deps optional ([#92](https://github.com/pleaseai/soop/issues/92)) ([edf43fe](https://github.com/pleaseai/soop/commit/edf43fe5e25871723ae1742f795471768560380d))
* **utils:** add claude-code LLM provider ([#66](https://github.com/pleaseai/soop/issues/66)) ([00d8ce2](https://github.com/pleaseai/soop/commit/00d8ce2165c568e41ca0cf890e2d328c450fbe25))
* **utils:** add Codex CLI LLM provider ([#73](https://github.com/pleaseai/soop/issues/73)) ([de76959](https://github.com/pleaseai/soop/commit/de76959321b351eb8b760252cc9804473de0dd89))


### Bug Fixes

* **build:** resolve Bun compile errors for cross-platform binary distribution ([#114](https://github.com/pleaseai/soop/issues/114)) ([1f9ce01](https://github.com/pleaseai/soop/commit/1f9ce01e67825b2019733f6c28cdfe984a4379d6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @pleaseai/soop-graph bumped to 0.1.4
    * @pleaseai/soop-store bumped to 0.1.4
    * @pleaseai/soop-utils bumped to 0.1.4

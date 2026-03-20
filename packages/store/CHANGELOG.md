# Changelog

## [0.1.9](https://github.com/pleaseai/soop/compare/soop-store-v0.1.8...soop-store-v0.1.9) (2026-03-20)


### Bug Fixes

* **encoder:** spread Map.entries() to array before calling toSorted ([#251](https://github.com/pleaseai/soop/issues/251)) ([8a49ae5](https://github.com/pleaseai/soop/commit/8a49ae5dc0f21f9e684d509382289557e8347889))

## [0.1.8](https://github.com/pleaseai/soop/compare/soop-store-v0.1.7...soop-store-v0.1.8) (2026-03-14)


### Features

* **store:** add BM25 scoring to LocalTextSearchStore ([#233](https://github.com/pleaseai/soop/issues/233)) ([d04445d](https://github.com/pleaseai/soop/commit/d04445dc81f19e12e7086d6fdb0c6ac48a918195))

## [0.1.7](https://github.com/pleaseai/soop/compare/soop-store-v0.1.6...soop-store-v0.1.7) (2026-03-12)


### Bug Fixes

* **store:** add bun:sqlite runtime adapter for compiled binary support ([#196](https://github.com/pleaseai/soop/issues/196)) ([1cdb1bc](https://github.com/pleaseai/soop/commit/1cdb1bc4f45c98250be74b47f7e5b14318c6dbfd))

## [0.1.6](https://github.com/pleaseai/soop/compare/soop-store-v0.1.5...soop-store-v0.1.6) (2026-03-09)


### Features

* **encoder:** change default LLM provider to google/gemini-3.1-flash-lite-preview ([#169](https://github.com/pleaseai/soop/issues/169)) ([88e833c](https://github.com/pleaseai/soop/commit/88e833c684b7749a2915a09e5920ba3baf38c1ea))
* rebrand from rpg to repo please with monorepo restructure ([#117](https://github.com/pleaseai/soop/issues/117)) ([d4b805a](https://github.com/pleaseai/soop/commit/d4b805abc23f20e8ac3fe1b375c105ba7a6c9b33))
* **store:** add zero-dependency local fallback stores and make native deps optional ([#92](https://github.com/pleaseai/soop/issues/92)) ([edf43fe](https://github.com/pleaseai/soop/commit/edf43fe5e25871723ae1742f795471768560380d))


### Bug Fixes

* **store:** use empty string sentinel for data_id and wrap migration in transaction ([#170](https://github.com/pleaseai/soop/issues/170)) ([b363018](https://github.com/pleaseai/soop/commit/b363018ac3728e72167b182b665ac9c5f2b9700c))

## [0.1.5](https://github.com/pleaseai/soop/compare/soop-store-v0.1.4...soop-store-v0.1.5) (2026-03-09)


### Features

* **encoder:** change default LLM provider to google/gemini-3.1-flash-lite-preview ([#169](https://github.com/pleaseai/soop/issues/169)) ([88e833c](https://github.com/pleaseai/soop/commit/88e833c684b7749a2915a09e5920ba3baf38c1ea))


### Bug Fixes

* **store:** use empty string sentinel for data_id and wrap migration in transaction ([#170](https://github.com/pleaseai/soop/issues/170)) ([b363018](https://github.com/pleaseai/soop/commit/b363018ac3728e72167b182b665ac9c5f2b9700c))

## [0.1.4](https://github.com/pleaseai/soop/compare/soop-store-v0.1.3...soop-store-v0.1.4) (2026-02-25)


### Features

* rebrand from rpg to repo please with monorepo restructure ([#117](https://github.com/pleaseai/soop/issues/117)) ([d4b805a](https://github.com/pleaseai/soop/commit/d4b805abc23f20e8ac3fe1b375c105ba7a6c9b33))
* **store:** add zero-dependency local fallback stores and make native deps optional ([#92](https://github.com/pleaseai/soop/issues/92)) ([edf43fe](https://github.com/pleaseai/soop/commit/edf43fe5e25871723ae1742f795471768560380d))

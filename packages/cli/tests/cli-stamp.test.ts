import { mkdtempSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { RepositoryPlanningGraph } from '@pleaseai/soop-graph'
import { metaPathFor } from '@pleaseai/soop-graph/meta'
import { getHeadCommitSha } from '@pleaseai/soop-utils/git-helpers'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('stamp / last-commit logic', () => {
  let tempDir: string
  let rpgFile: string

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rpg-test-'))
    rpgFile = path.join(tempDir, 'test.json')

    const rpg = await RepositoryPlanningGraph.create({
      name: 'test-repo',
      rootPath: process.cwd(),
    })
    const { graphJson, metaJson } = await rpg.toJSONWithMeta()
    await writeFile(rpgFile, graphJson)
    await writeFile(metaPathFor(rpgFile), metaJson)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('stamp should set config.github.commit to HEAD via meta file', async () => {
    const graphJson = await readFile(rpgFile, 'utf-8')
    const metaJson = await readFile(metaPathFor(rpgFile), 'utf-8')
    const rpg = await RepositoryPlanningGraph.fromJSONWithMeta(graphJson, metaJson)
    const repoPath = rpg.getConfig().rootPath ?? '.'
    const headSha = getHeadCommitSha(path.resolve(repoPath))
    const currentConfig = rpg.getConfig()

    rpg.updateConfig({
      github: {
        owner: currentConfig.github?.owner ?? '',
        repo: currentConfig.github?.repo ?? currentConfig.name,
        commit: headSha,
        pathPrefix: currentConfig.github?.pathPrefix,
      },
    })

    const result = await rpg.toJSONWithMeta()
    await writeFile(rpgFile, result.graphJson)
    await writeFile(metaPathFor(rpgFile), result.metaJson)

    // Verify persisted in meta file
    const restoredMeta = await readFile(metaPathFor(rpgFile), 'utf-8')
    const meta = JSON.parse(restoredMeta)
    expect(meta.github?.commit).toBe(headSha)
    expect(headSha).toMatch(/^[0-9a-f]{40}$/)
  })

  it('last-commit should read the stamped commit from meta file', async () => {
    const rpg = await RepositoryPlanningGraph.create({
      name: 'test',
      rootPath: '.',
      github: { owner: 'a', repo: 'b', commit: 'abc123def456789012345678901234567890abcd' },
    })
    const { graphJson, metaJson } = await rpg.toJSONWithMeta()
    const restored = await RepositoryPlanningGraph.fromJSONWithMeta(graphJson, metaJson)
    const commit = restored.getConfig().github?.commit
    expect(commit).toBe('abc123def456789012345678901234567890abcd')
  })

  it('last-commit should be undefined if no commit stamp', async () => {
    const rpg = await RepositoryPlanningGraph.create({ name: 'test' })
    const commit = rpg.getConfig().github?.commit
    expect(commit).toBeUndefined()
  })
})

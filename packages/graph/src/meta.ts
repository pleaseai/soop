import type { RPGConfig } from './rpg'
import path from 'node:path'
import { z } from 'zod/v4'

export const RPGMetaSchema = z.object({
  version: z.string(),
  rootPath: z.string().optional(),
  github: z.object({
    owner: z.string(),
    repo: z.string(),
    commit: z.string(),
    pathPrefix: z.string().optional(),
  }).optional(),
})

export type RPGMeta = z.infer<typeof RPGMetaSchema>

export function metaPathFor(graphPath: string): string {
  const dir = path.dirname(graphPath)
  const ext = path.extname(graphPath)
  const base = path.basename(graphPath, ext)
  return path.join(dir, `${base}.meta${ext}`)
}

export function serializeMeta(config: RPGConfig): RPGMeta {
  return {
    version: '2.0.0',
    rootPath: config.rootPath,
    github: config.github,
  }
}

export function deserializeMeta(data: unknown): RPGMeta {
  return RPGMetaSchema.parse(data)
}

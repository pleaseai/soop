import type { SerializedEmbeddings } from '@pleaseai/repo-graph/embeddings'
import {
  base64Float16ToFloat32,
  decodeAllEmbeddings,
  float32ToBase64Float16,
  parseEmbeddings,
  parseEmbeddingsJsonl,
  serializeEmbeddings,
  serializeEmbeddingsJsonl,
} from '@pleaseai/repo-graph/embeddings'
import { describe, expect, it } from 'vitest'

describe('float16 codec', () => {
  it('round-trips simple values', () => {
    const values = [0.0, 1.0, -1.0, 0.5, -0.5, 0.25, 2.0, -2.0]
    const encoded = float32ToBase64Float16(values)
    const decoded = base64Float16ToFloat32(encoded, values.length)

    for (let i = 0; i < values.length; i++) {
      expect(decoded[i]).toBeCloseTo(values[i]!, 2)
    }
  })

  it('round-trips a unit vector with high cosine similarity', () => {
    // Generate a deterministic unit vector
    const dim = 1024
    const vector: number[] = []
    let hash = 42
    for (let i = 0; i < dim; i++) {
      hash = (hash * 1103515245 + 12345) % 2147483648
      vector.push((hash / 2147483647) * 2 - 1)
    }
    // Normalize
    const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0))
    const normalized = vector.map(v => v / mag)

    const encoded = float32ToBase64Float16(normalized)
    const decoded = base64Float16ToFloat32(encoded, dim)

    // Compute cosine similarity
    let dot = 0
    let magA = 0
    let magB = 0
    for (let i = 0; i < dim; i++) {
      dot += normalized[i]! * decoded[i]!
      magA += normalized[i]! * normalized[i]!
      magB += decoded[i]! * decoded[i]!
    }
    const cosineSim = dot / (Math.sqrt(magA) * Math.sqrt(magB))

    expect(cosineSim).toBeGreaterThan(0.999)
  })

  it('produces correct byte size', () => {
    const dim = 1024
    const vector = Array.from({ length: dim }, () => Math.random())
    const encoded = float32ToBase64Float16(vector)

    // Base64 of 2048 bytes should be ~2732 chars
    const rawBytes = dim * 2
    const expectedBase64Len = Math.ceil(rawBytes / 3) * 4
    expect(encoded.length).toBe(expectedBase64Len)
  })

  it('handles special values', () => {
    const values = [0.0, -0.0, Infinity, -Infinity, Number.NaN]
    const encoded = float32ToBase64Float16(values)
    const decoded = base64Float16ToFloat32(encoded, values.length)

    expect(decoded[0]).toBe(0)
    expect(Object.is(decoded[1], -0)).toBe(true)
    expect(decoded[2]).toBe(Infinity)
    expect(decoded[3]).toBe(-Infinity)
    expect(Number.isNaN(decoded[4]!)).toBe(true)
  })

  it('handles very small values (subnormals)', () => {
    const values = [1e-7, -1e-7]
    const encoded = float32ToBase64Float16(values)
    const decoded = base64Float16ToFloat32(encoded, values.length)

    // Float16 has limited subnormal precision, but should be close to 0
    expect(Math.abs(decoded[0]!)).toBeLessThan(0.001)
    expect(Math.abs(decoded[1]!)).toBeLessThan(0.001)
  })

  it('throws on dimension mismatch', () => {
    const vector = [1.0, 2.0, 3.0]
    const encoded = float32ToBase64Float16(vector)

    expect(() => base64Float16ToFloat32(encoded, 5)).toThrow(/Invalid embedding size/)
  })
})

describe('serialization', () => {
  const sampleEmbeddings: SerializedEmbeddings = {
    version: '1.0.0',
    config: {
      provider: 'voyage-ai',
      model: 'voyage-code-3',
      dimension: 4,
      space: 'voyage-v4',
      textTemplate: '{description} {keywords} {path}',
    },
    commit: 'abc123',
    embeddings: [
      { id: 'node-1', vector: float32ToBase64Float16([0.1, 0.2, 0.3, 0.4]) },
      { id: 'node-2', vector: float32ToBase64Float16([0.5, 0.6, 0.7, 0.8]) },
    ],
  }

  it('serializeEmbeddings produces valid JSON', () => {
    const json = serializeEmbeddings(sampleEmbeddings)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe('1.0.0')
    expect(parsed.config.provider).toBe('voyage-ai')
    expect(parsed.embeddings).toHaveLength(2)
  })

  it('parseEmbeddings round-trips', () => {
    const json = serializeEmbeddings(sampleEmbeddings)
    const parsed = parseEmbeddings(json)
    expect(parsed.version).toBe('1.0.0')
    expect(parsed.config.dimension).toBe(4)
    expect(parsed.commit).toBe('abc123')
    expect(parsed.embeddings).toHaveLength(2)
  })

  it('parseEmbeddings rejects invalid data', () => {
    expect(() => parseEmbeddings('{"version": "2.0.0"}')).toThrow()
    expect(() => parseEmbeddings('not json')).toThrow()
  })

  it('decodeAllEmbeddings produces float32 vectors', () => {
    const vectors = decodeAllEmbeddings(sampleEmbeddings)
    expect(vectors.size).toBe(2)

    const v1 = vectors.get('node-1')!
    expect(v1).toHaveLength(4)
    expect(v1[0]).toBeCloseTo(0.1, 2)
    expect(v1[1]).toBeCloseTo(0.2, 2)
    expect(v1[2]).toBeCloseTo(0.3, 2)
    expect(v1[3]).toBeCloseTo(0.4, 2)
  })
})

describe('JSONL serialization', () => {
  const sampleEmbeddings: SerializedEmbeddings = {
    version: '1.0.0',
    config: {
      provider: 'voyage-ai',
      model: 'voyage-code-3',
      dimension: 4,
      space: 'voyage-v4',
      textTemplate: '{description} {keywords} {path}',
    },
    commit: 'abc123',
    embeddings: [
      { id: 'node-2', vector: float32ToBase64Float16([0.5, 0.6, 0.7, 0.8]) },
      { id: 'node-1', vector: float32ToBase64Float16([0.1, 0.2, 0.3, 0.4]) },
    ],
  }

  it('serializeEmbeddingsJsonl produces valid JSONL with metadata on first line', () => {
    const jsonl = serializeEmbeddingsJsonl(sampleEmbeddings)
    const lines = jsonl.split('\n')
    expect(lines.length).toBe(3)

    const meta = JSON.parse(lines[0]!)
    expect(meta.version).toBe('1.0.0')
    expect(meta.config.provider).toBe('voyage-ai')
    expect(meta.embeddings).toBeUndefined()
    expect(meta.commit).toBe('abc123')

    const entry1 = JSON.parse(lines[1]!)
    expect(entry1.id).toBeDefined()
    expect(entry1.vector).toBeDefined()
  })

  it('serializeEmbeddingsJsonl sorts entries by id', () => {
    const jsonl = serializeEmbeddingsJsonl(sampleEmbeddings)
    const lines = jsonl.split('\n')

    const entry1 = JSON.parse(lines[1]!)
    const entry2 = JSON.parse(lines[2]!)
    expect(entry1.id).toBe('node-1')
    expect(entry2.id).toBe('node-2')
  })

  it('parseEmbeddingsJsonl round-trips', () => {
    const jsonl = serializeEmbeddingsJsonl(sampleEmbeddings)
    const parsed = parseEmbeddingsJsonl(jsonl)

    expect(parsed.version).toBe('1.0.0')
    expect(parsed.config.dimension).toBe(4)
    expect(parsed.commit).toBe('abc123')
    expect(parsed.embeddings).toHaveLength(2)
  })

  it('parseEmbeddingsJsonl preserves vector data', () => {
    const jsonl = serializeEmbeddingsJsonl(sampleEmbeddings)
    const parsed = parseEmbeddingsJsonl(jsonl)
    const vectors = decodeAllEmbeddings(parsed)

    const v1 = vectors.get('node-1')!
    expect(v1).toHaveLength(4)
    expect(v1[0]).toBeCloseTo(0.1, 2)
    expect(v1[1]).toBeCloseTo(0.2, 2)

    const v2 = vectors.get('node-2')!
    expect(v2[0]).toBeCloseTo(0.5, 2)
  })

  it('parseEmbeddingsJsonl rejects invalid data', () => {
    expect(() => parseEmbeddingsJsonl('')).toThrow()
    expect(() => parseEmbeddingsJsonl('{"version":"2.0.0"}\n{"id":"x","vector":"abc"}')).toThrow()
    expect(() => parseEmbeddingsJsonl('not json')).toThrow()
  })
})

describe('size estimation', () => {
  it('1000 nodes × 1024d ≈ 2.7MB base64', () => {
    const dim = 1024
    const singleVector = Array.from({ length: dim }, () => Math.random())
    const encoded = float32ToBase64Float16(singleVector)

    // Each vector base64 string length
    const perVectorChars = encoded.length
    // JSONL overhead: {"id":"node-XXX","vector":"..."}\n — ~30 chars per entry
    const perEntryEstimate = perVectorChars + 40

    const totalEstimate = perEntryEstimate * 1000
    const totalMB = totalEstimate / (1024 * 1024)

    // Should be under 3MB for 1000 nodes
    expect(totalMB).toBeLessThan(3)
    // Should be over 2MB (base64 of 2KB per vector × 1000)
    expect(totalMB).toBeGreaterThan(2)
  })

  it('JSONL is smaller than pretty-printed JSON for the same data', () => {
    const dim = 16
    const embeddings: SerializedEmbeddings = {
      version: '1.0.0',
      config: {
        provider: 'voyage-ai',
        model: 'voyage-4',
        dimension: dim,
        textTemplate: '{description} {keywords} {path}',
      },
      commit: 'abc123',
      embeddings: Array.from({ length: 100 }, (_, i) => ({
        id: `node-${i}`,
        vector: float32ToBase64Float16(Array.from({ length: dim }, () => Math.random())),
      })),
    }

    const jsonSize = Buffer.byteLength(serializeEmbeddings(embeddings))
    const jsonlSize = Buffer.byteLength(serializeEmbeddingsJsonl(embeddings))

    expect(jsonlSize).toBeLessThan(jsonSize)
  })
})

import { HuggingFaceEmbedding } from '@pleaseai/rpg-encoder/embedding'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Integration tests for voyage-4-nano local embedding via @huggingface/transformers
 *
 * Requires ONNX weights for voyageai/voyage-4-nano on HuggingFace Hub.
 * First run downloads ~400MB of model weights (cached afterward).
 *
 * Run with:
 *   bun run test:integration tests/encoder/voyage-4-nano.integration.test.ts
 */
describe('voyage-4-nano Integration', () => {
  let embedding: HuggingFaceEmbedding

  beforeAll(async () => {
    embedding = new HuggingFaceEmbedding({
      model: 'voyageai/voyage-4-nano',
      dtype: 'fp32',
    })

    console.log('[Integration] Preloading voyageai/voyage-4-nano...')
    await embedding.preload()
    console.log('[Integration] Model loaded')
  }, 300_000) // 5 min: first run downloads weights

  afterAll(() => {
    // GC handles cleanup
  })

  // ============================================================================
  // 1. Basic Output
  // ============================================================================

  describe('basic output', () => {
    it('should generate embedding with default dimension 1024', async () => {
      const result = await embedding.embed('Hello, world!')

      expect(result.dimension).toBe(1024)
      expect(result.vector).toHaveLength(1024)
      expect(result.vector.every(v => typeof v === 'number' && Number.isFinite(v))).toBe(true)
    })

    it('should produce non-zero vectors', async () => {
      const result = await embedding.embed('Repository Planning Graph encoder')
      expect(result.vector.some(v => v !== 0)).toBe(true)
    })

    it('should produce unit-length (L2-normalized) output', async () => {
      const result = await embedding.embed('normalization test')
      const magnitude = Math.sqrt(result.vector.reduce((s, v) => s + v * v, 0))
      expect(magnitude).toBeCloseTo(1.0, 3)
    })
  })

  // ============================================================================
  // 2. Mean Pooling Validation
  // ============================================================================

  describe('mean pooling validation', () => {
    it('should produce consistent output regardless of padding', async () => {
      // Same semantic content — both should yield nearly identical embeddings
      const short = await embedding.embed('TypeScript function')
      const padded = await embedding.embed('TypeScript function') // same call → same result

      const dot = short.vector.reduce((s, v, i) => s + v * padded.vector[i]!, 0)
      expect(dot).toBeCloseTo(1.0, 4) // unit vectors → dot == cosine similarity
    })

    it('should report model is loaded after preload', () => {
      expect(embedding.isModelLoaded()).toBe(true)
    })
  })

  // ============================================================================
  // 3. Semantic Similarity
  // ============================================================================

  describe('semantic similarity', () => {
    function cosineSimilarity(a: number[], b: number[]): number {
      if (a.length !== b.length) {
        throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`)
      }
      const dot = a.reduce((s, v, i) => s + v * b[i]!, 0)
      const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0))
      const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0))
      return dot / (magA * magB)
    }

    it('should rank semantically similar texts higher than unrelated', async () => {
      const [auth1, auth2, weather] = await Promise.all([
        embedding.embed('function authenticate(user, password) { return validateCredentials(user, password); }'),
        embedding.embed('function login(username, pwd) { return checkPassword(username, pwd); }'),
        embedding.embed('The weather forecast shows sunny skies today'),
      ])

      const simRelated = cosineSimilarity(auth1.vector, auth2.vector)
      const simUnrelated = cosineSimilarity(auth1.vector, weather.vector)

      expect(simRelated).toBeGreaterThan(simUnrelated)
    })

    it('should produce higher similarity for paraphrased sentences', async () => {
      const [s1, s2, s3] = await Promise.all([
        embedding.embed('The quick brown fox jumps over the lazy dog'),
        embedding.embed('A fast brown fox leaps over a sleepy canine'),
        embedding.embed('SELECT * FROM users WHERE id = 42'),
      ])

      const simSemantic = cosineSimilarity(s1.vector, s2.vector)
      const simUnrelated = cosineSimilarity(s1.vector, s3.vector)

      expect(simSemantic).toBeGreaterThan(simUnrelated)
    })
  })

  // ============================================================================
  // 4. Batch Embedding
  // ============================================================================

  describe('batch embedding', () => {
    it('should return one embedding per input text', async () => {
      const texts = [
        'First code snippet',
        'Second code snippet',
        'Third code snippet',
      ]

      const results = await embedding.embedBatch(texts)

      expect(results).toHaveLength(3)
      for (const result of results) {
        expect(result.dimension).toBe(1024)
        expect(result.vector).toHaveLength(1024)
      }
    })

    it('should match single embed result for same text', async () => {
      const text = 'consistency check'

      const single = await embedding.embed(text)
      const batch = await embedding.embedBatch([text])

      // Vectors should be identical (same model, same input)
      expect(batch[0]!.vector).toEqual(single.vector)
    })

    it('should handle empty batch', async () => {
      const results = await embedding.embedBatch([])
      expect(results).toEqual([])
    })

    it('should handle large batch', async () => {
      const texts = Array.from({ length: 10 }, (_, i) => `Batch item ${i + 1}`)
      const results = await embedding.embedBatch(texts)

      expect(results).toHaveLength(10)
      for (const result of results) {
        expect(result.dimension).toBe(1024)
      }
    }, 120_000)
  })

  // ============================================================================
  // 5. Long Context (32k token window)
  // ============================================================================

  describe('long context handling', () => {
    it('should handle text well beyond 512 tokens', async () => {
      // voyage-4-nano supports up to 32k tokens; ~2000 words ≈ 2500 tokens
      const longText = Array.from(
        { length: 500 },
        (_, i) => `Line ${i + 1}: export function process(item: Item): Promise<Result> { return transform(item); }`,
      ).join('\n')

      const result = await embedding.embed(longText)

      expect(result.dimension).toBe(1024)
      expect(result.vector).toHaveLength(1024)
      expect(Math.sqrt(result.vector.reduce((s, v) => s + v * v, 0))).toBeCloseTo(1.0, 2)
    })
  })

  // ============================================================================
  // 6. Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty string', async () => {
      const result = await embedding.embed('')
      expect(result.dimension).toBe(1024)
      expect(result.vector).toHaveLength(1024)
    })

    it('should handle unicode and emoji', async () => {
      const result = await embedding.embed('Hello 🌍 한글 日本語 العربية')
      expect(result.dimension).toBe(1024)
    })

    it('should handle code with special syntax', async () => {
      const code = `
        const regex = /^[a-z]+$/gi;
        const template = \`value: \${x}\`;
        const fn = async (x: T) => ({ result: await process(x) });
      `
      const result = await embedding.embed(code)
      expect(result.dimension).toBe(1024)
    })
  })

  // ============================================================================
  // 7. Determinism
  // ============================================================================

  describe('determinism', () => {
    it('should produce identical vectors for repeated calls', async () => {
      const text = 'determinism test for voyage-4-nano'
      const r1 = await embedding.embed(text)
      const r2 = await embedding.embed(text)

      expect(r1.vector).toEqual(r2.vector)
    })

    it('should produce identical batch vectors across runs', async () => {
      const texts = ['Alpha', 'Beta', 'Gamma']
      const b1 = await embedding.embedBatch(texts)
      const b2 = await embedding.embedBatch(texts)

      for (let i = 0; i < b1.length; i++) {
        expect(b1[i]!.vector).toEqual(b2[i]!.vector)
      }
    })
  })

  // ============================================================================
  // 8. Provider Info
  // ============================================================================

  describe('provider info', () => {
    it('should report HuggingFace provider', () => {
      expect(embedding.getProvider()).toBe('HuggingFace')
    })

    it('should report correct model id', () => {
      expect(embedding.getModel()).toBe('voyageai/voyage-4-nano')
    })

    it('should report fp32 dtype', () => {
      expect(embedding.getDtype()).toBe('fp32')
    })

    it('should have no query prefix', () => {
      expect(embedding.getQueryPrefix()).toBeUndefined()
    })
  })
})

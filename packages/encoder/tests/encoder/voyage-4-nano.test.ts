import { HuggingFaceEmbedding } from '@pleaseai/repo-encoder/embedding'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// Helpers
// ============================================================================

type MockTolist = () => unknown
interface MockTensor { tolist: MockTolist }

function makeTensor(data: unknown): MockTensor {
  return { tolist: () => data }
}

function l2norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0))
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * b[i]!, 0)
  return dot / (l2norm(a) * l2norm(b))
}

// ============================================================================
// Factory for a mocked HuggingFaceEmbedding
//
// We spy on the private `getTransformersModule` method to avoid downloading
// real model weights. This lets us control what the tokenizer and model return.
// ============================================================================

function makeTokenizer(attentionMask: number[][]): object {
  return vi.fn().mockResolvedValue({ attention_mask: makeTensor(attentionMask) })
}

function makeModel(output: object): object {
  return vi.fn().mockResolvedValue(output)
}

function stubTransformers(
  embedding: HuggingFaceEmbedding,
  tokenizerFn: object,
  modelFn: object,
): void {
  const fakeModule = {
    env: {},
    AutoTokenizer: { from_pretrained: vi.fn().mockResolvedValue(tokenizerFn) },
    AutoModel: { from_pretrained: vi.fn().mockResolvedValue(modelFn) },
  }
  vi.spyOn(embedding as unknown as { getTransformersModule: () => Promise<unknown> }, 'getTransformersModule')
    .mockResolvedValue(fakeModule)
}

// ============================================================================
// 1. Model Registry
// ============================================================================

describe('voyage-4-nano model registry', () => {
  it('should be registered in supported models', () => {
    const models = HuggingFaceEmbedding.getSupportedModels()
    expect(models['voyageai/voyage-4-nano']).toBeDefined()
  })

  it('should have dimension 1024', () => {
    const models = HuggingFaceEmbedding.getSupportedModels()
    expect(models['voyageai/voyage-4-nano']!.dimension).toBe(1024)
  })

  it('should have maxTokens 32000', () => {
    const models = HuggingFaceEmbedding.getSupportedModels()
    expect(models['voyageai/voyage-4-nano']!.maxTokens).toBe(32000)
  })

  it('should use mean_pooling strategy', () => {
    const models = HuggingFaceEmbedding.getSupportedModels()
    expect(models['voyageai/voyage-4-nano']!.poolingStrategy).toBe('mean_pooling')
  })

  it('should have no query prefix', () => {
    const models = HuggingFaceEmbedding.getSupportedModels()
    expect(models['voyageai/voyage-4-nano']!.queryPrefix).toBeUndefined()
  })
})

// ============================================================================
// 2. Constructor defaults
// ============================================================================

describe('voyage-4-nano constructor', () => {
  it('should set dimension to 1024', () => {
    const embedding = new HuggingFaceEmbedding({ model: 'voyageai/voyage-4-nano' })
    expect(embedding.getDimension()).toBe(1024)
  })

  it('should set provider to HuggingFace', () => {
    const embedding = new HuggingFaceEmbedding({ model: 'voyageai/voyage-4-nano' })
    expect(embedding.getProvider()).toBe('HuggingFace')
  })

  it('should store model id', () => {
    const embedding = new HuggingFaceEmbedding({ model: 'voyageai/voyage-4-nano' })
    expect(embedding.getModel()).toBe('voyageai/voyage-4-nano')
  })

  it('should have no query prefix', () => {
    const embedding = new HuggingFaceEmbedding({ model: 'voyageai/voyage-4-nano' })
    expect(embedding.getQueryPrefix()).toBeUndefined()
  })
})

// ============================================================================
// 3. Mean Pooling Logic (spied model)
// ============================================================================

describe('mean pooling via spied model', () => {
  let embedding: HuggingFaceEmbedding

  beforeEach(() => {
    vi.restoreAllMocks()
    embedding = new HuggingFaceEmbedding({ model: 'voyageai/voyage-4-nano' })
  })

  it('should apply mean pooling over masked tokens and L2-normalize', async () => {
    // 3 tokens, dim=2; only first 2 are unmasked
    const attentionMask = [[1, 1, 0]]
    const hiddenStates = [[[1, 0], [0, 1], [99, 99]]] // batch=1, seq=3, dim=2
    stubTransformers(
      embedding,
      makeTokenizer(attentionMask),
      makeModel({ last_hidden_state: makeTensor(hiddenStates) }),
    )

    const result = await embedding.embed('test')

    // mean of [1,0] and [0,1] = [0.5, 0.5], normalized → [1/√2, 1/√2]
    const expected = 1 / Math.sqrt(2)
    expect(result.vector[0]).toBeCloseTo(expected, 5)
    expect(result.vector[1]).toBeCloseTo(expected, 5)
    expect(result.dimension).toBe(2)
  })

  it('should produce unit-length (L2-normalized) embedding', async () => {
    const dim = 16
    const row = Array.from({ length: dim }, (_, i) => Math.sin(i * 0.3))
    stubTransformers(
      embedding,
      makeTokenizer([[1, 1, 1, 1]]),
      makeModel({ last_hidden_state: makeTensor([[row, row, row, row]]) }),
    )

    const result = await embedding.embed('hello world')
    expect(l2norm(result.vector)).toBeCloseTo(1.0, 5)
  })

  it('should ignore padding tokens (mask=0) in mean pooling', async () => {
    // Token 0: [1,0,0], Token 1: padding [99,99,99]
    stubTransformers(
      embedding,
      makeTokenizer([[1, 0]]),
      makeModel({ last_hidden_state: makeTensor([[[1, 0, 0], [99, 99, 99]]]) }),
    )

    const result = await embedding.embed('test')

    // Only token 0 contributes: mean([1,0,0]) → normalized [1,0,0]
    expect(result.vector[0]).toBeCloseTo(1.0, 5)
    expect(result.vector[1]).toBeCloseTo(0.0, 5)
    expect(result.vector[2]).toBeCloseTo(0.0, 5)
  })

  it('should handle single-token input', async () => {
    // [0.6, 0.8] → already unit length (0.36+0.64=1)
    stubTransformers(
      embedding,
      makeTokenizer([[1]]),
      makeModel({ last_hidden_state: makeTensor([[[0.6, 0.8]]]) }),
    )

    const result = await embedding.embed('hi')
    expect(result.vector[0]).toBeCloseTo(0.6, 5)
    expect(result.vector[1]).toBeCloseTo(0.8, 5)
    expect(l2norm(result.vector)).toBeCloseTo(1.0, 5)
  })

  it('should throw when last_hidden_state is missing', async () => {
    stubTransformers(
      embedding,
      makeTokenizer([[1]]),
      makeModel({ sentence_embedding: makeTensor([[0.1, 0.2]]) }),
    )

    await expect(embedding.embed('test')).rejects.toThrow(
      'Model did not return last_hidden_state for mean_pooling strategy',
    )
  })

  it('should propagate model load failure', async () => {
    const fakeModule = {
      env: {},
      AutoTokenizer: { from_pretrained: vi.fn().mockResolvedValue(vi.fn()) },
      AutoModel: { from_pretrained: vi.fn().mockRejectedValue(new Error('Download failed')) },
    }
    vi.spyOn(embedding as unknown as { getTransformersModule: () => Promise<unknown> }, 'getTransformersModule')
      .mockResolvedValue(fakeModule)

    await expect(embedding.embed('test')).rejects.toThrow(
      'Failed to load HuggingFace model voyageai/voyage-4-nano: Download failed',
    )
  })
})

// ============================================================================
// 4. Batch Mean Pooling (spied model)
// ============================================================================

describe('batch mean pooling via spied model', () => {
  let embedding: HuggingFaceEmbedding

  beforeEach(() => {
    vi.restoreAllMocks()
    embedding = new HuggingFaceEmbedding({ model: 'voyageai/voyage-4-nano' })
  })

  it('should return one embedding per input text', async () => {
    const hiddenStates = [
      [[1, 0], [0, 1]], // item 0
      [[0, 1], [1, 0]], // item 1
    ]
    stubTransformers(
      embedding,
      makeTokenizer([[1, 1], [1, 1]]),
      makeModel({ last_hidden_state: makeTensor(hiddenStates) }),
    )

    const results = await embedding.embedBatch(['text1', 'text2'])

    expect(results).toHaveLength(2)
    for (const result of results) {
      expect(l2norm(result.vector)).toBeCloseTo(1.0, 5)
      expect(result.dimension).toBe(2)
    }
  })

  it('should handle different mask patterns per batch item', async () => {
    const hiddenStates = [
      [[1, 0, 0], [0, 1, 0], [99, 99, 99]], // item 0: 2 real tokens
      [[0, 0, 1], [99, 99, 99], [99, 99, 99]], // item 1: 1 real token
    ]
    stubTransformers(
      embedding,
      makeTokenizer([[1, 1, 0], [1, 0, 0]]),
      makeModel({ last_hidden_state: makeTensor(hiddenStates) }),
    )

    const results = await embedding.embedBatch(['longer text', 'hi'])

    expect(results).toHaveLength(2)
    // Item 1: mean([0,0,1]) → [0,0,1] normalized
    expect(l2norm(results[0]!.vector)).toBeCloseTo(1.0, 5)
    expect(results[1]!.vector[2]).toBeCloseTo(1.0, 5)
  })

  it('should return empty array for empty batch', async () => {
    const results = await embedding.embedBatch([])
    expect(results).toEqual([])
  })

  it('should produce consistent single vs batch output', async () => {
    const hs: number[][][] = [[[0.3, 0.4, 0.0]]]

    // Single embed
    stubTransformers(
      embedding,
      makeTokenizer([[1]]),
      makeModel({ last_hidden_state: makeTensor(hs) }),
    )
    const single = await embedding.embed('same text')

    // Must re-stub because model is cached after first load
    // Reset and create fresh embedding for batch
    vi.restoreAllMocks()
    const embedding2 = new HuggingFaceEmbedding({ model: 'voyageai/voyage-4-nano' })
    stubTransformers(
      embedding2,
      makeTokenizer([[1]]),
      makeModel({ last_hidden_state: makeTensor(hs) }),
    )
    const batch = await embedding2.embedBatch(['same text'])

    expect(batch[0]!.vector).toEqual(single.vector)
  })

  it('should throw when last_hidden_state missing in batch', async () => {
    stubTransformers(
      embedding,
      makeTokenizer([[1, 1]]),
      makeModel({ sentence_embedding: makeTensor([[0.1, 0.2]]) }),
    )

    await expect(embedding.embedBatch(['text'])).rejects.toThrow(
      'Model did not return last_hidden_state for mean_pooling strategy',
    )
  })
})

// ============================================================================
// 5. Contrast with LEAF (sentence_embedding) model
// ============================================================================

describe('sentence_embedding strategy (LEAF models unchanged)', () => {
  let leafEmbedding: HuggingFaceEmbedding

  beforeEach(() => {
    vi.restoreAllMocks()
    leafEmbedding = new HuggingFaceEmbedding({ model: 'MongoDB/mdbr-leaf-ir' })
  })

  it('should use sentence_embedding output for LEAF IR model', async () => {
    stubTransformers(
      leafEmbedding,
      makeTokenizer([[1, 1]]),
      makeModel({ sentence_embedding: makeTensor([[0.1, 0.2, 0.3]]) }),
    )

    const result = await leafEmbedding.embed('test')
    expect(result.vector).toEqual([0.1, 0.2, 0.3])
  })

  it('should throw if sentence_embedding is missing for LEAF model', async () => {
    stubTransformers(
      leafEmbedding,
      makeTokenizer([[1]]),
      makeModel({ last_hidden_state: makeTensor([[[0.1, 0.2]]]) }),
    )

    await expect(leafEmbedding.embed('test')).rejects.toThrow(
      'Model did not return sentence_embedding',
    )
  })
})

// ============================================================================
// 6. Semantic properties of mean-pooled output
// ============================================================================

describe('semantic properties of mean-pooled embeddings', () => {
  let embedding: HuggingFaceEmbedding

  beforeEach(() => {
    vi.restoreAllMocks()
    embedding = new HuggingFaceEmbedding({ model: 'voyageai/voyage-4-nano' })
  })

  it('should produce identical outputs for identical hidden states', async () => {
    const hs = [[[0.5, 0.5], [0.3, 0.7]]]
    const mask = [[1, 1]]

    stubTransformers(embedding, makeTokenizer(mask), makeModel({ last_hidden_state: makeTensor(hs) }))
    const result1 = await embedding.embed('deterministic')

    // Model is cached after first call — same output will be returned by the tokenizer mock
    // for the second call (no re-stub needed for the same embedding instance)
    const result2 = await embedding.embed('deterministic')

    expect(result1.vector).toEqual(result2.vector)
  })

  it('should produce cosine similarity = 1 for same content with different padding', async () => {
    // Text A: 2 real tokens
    stubTransformers(
      embedding,
      makeTokenizer([[1, 1]]),
      makeModel({ last_hidden_state: makeTensor([[[1, 0], [0, 1]]]) }),
    )
    const resultA = await embedding.embed('text A')

    // Create new instance for Text B
    vi.restoreAllMocks()
    const embedding2 = new HuggingFaceEmbedding({ model: 'voyageai/voyage-4-nano' })
    // Same real tokens + 1 padding → same pooled result
    stubTransformers(
      embedding2,
      makeTokenizer([[1, 1, 0]]),
      makeModel({ last_hidden_state: makeTensor([[[1, 0], [0, 1], [99, 99]]]) }),
    )
    const resultB = await embedding2.embed('text B with padding')

    const similarity = cosineSimilarity(resultA.vector, resultB.vector)
    expect(similarity).toBeCloseTo(1.0, 5)
  })
})

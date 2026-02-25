import type { FileFeatureGroup } from '@pleaseai/repo-encoder/reorganization'
import { DomainDiscovery } from '@pleaseai/repo-encoder/reorganization/domain-discovery'
import { describe, expect, it, vi } from 'vitest'

function createMockLLMClient(areas: string[]) {
  const responseContent = JSON.stringify({ functionalAreas: areas })
  return {
    complete: vi.fn().mockResolvedValue({
      content: responseContent,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: 'test-model',
    }),
    completeJSON: vi.fn(),
    getProvider: vi.fn().mockReturnValue('google'),
    getModel: vi.fn().mockReturnValue('test-model'),
  }
}

const sampleFileGroups: FileFeatureGroup[] = [
  {
    groupLabel: 'src/auth',
    fileFeatures: [
      {
        fileId: 'auth/login.ts:file',
        filePath: 'src/auth/login.ts',
        description: 'authenticate user credentials',
        keywords: ['auth', 'login'],
      },
      {
        fileId: 'auth/token.ts:file',
        filePath: 'src/auth/token.ts',
        description: 'manage JWT tokens',
        keywords: ['auth', 'token'],
      },
    ],
  },
  {
    groupLabel: 'src/db',
    fileFeatures: [
      {
        fileId: 'db/query.ts:file',
        filePath: 'src/db/query.ts',
        description: 'execute database queries',
        keywords: ['db', 'query'],
      },
    ],
  },
  {
    groupLabel: 'src/api',
    fileFeatures: [
      {
        fileId: 'api/routes.ts:file',
        filePath: 'src/api/routes.ts',
        description: 'define API routes',
        keywords: ['api', 'routes'],
      },
    ],
  },
]

describe('domainDiscovery', () => {
  it('returns correct PascalCase functional areas', async () => {
    const mockClient = createMockLLMClient(['Authentication', 'DataAccess', 'ApiManagement'])

    const discovery = new DomainDiscovery(mockClient as any)
    const result = await discovery.discover(sampleFileGroups)

    expect(result.functionalAreas).toContain('Authentication')
    expect(result.functionalAreas).toContain('DataAccess')
    expect(result.functionalAreas).toContain('ApiManagement')
    // Default maxIterations=3, so complete() called 3 times
    expect(mockClient.complete).toHaveBeenCalledTimes(3)
  })

  it('normalizes non-PascalCase names', async () => {
    const mockClient = createMockLLMClient(['data processing', 'user_authentication', 'apiManagement'])

    const discovery = new DomainDiscovery(mockClient as any)
    const result = await discovery.discover(sampleFileGroups)

    expect(result.functionalAreas).toContain('DataProcessing')
    expect(result.functionalAreas).toContain('UserAuthentication')
    expect(result.functionalAreas).toContain('ApiManagement')
  })

  it('deduplicates functional areas across iterations', async () => {
    const mockClient = createMockLLMClient(['Authentication', 'Authentication', 'DataAccess'])

    const discovery = new DomainDiscovery(mockClient as any)
    const result = await discovery.discover(sampleFileGroups)

    expect(result.functionalAreas).toContain('Authentication')
    expect(result.functionalAreas).toContain('DataAccess')
    // No duplicates in final result
    const unique = new Set(result.functionalAreas)
    expect(unique.size).toBe(result.functionalAreas.length)
  })

  it('handles single functional area', async () => {
    const mockClient = createMockLLMClient(['CoreEngine'])

    const singleGroup: FileFeatureGroup[] = [
      {
        groupLabel: 'src',
        fileFeatures: [
          {
            fileId: 'src/main.ts:file',
            filePath: 'src/main.ts',
            description: 'application entry point',
            keywords: ['main'],
          },
        ],
      },
    ]

    const discovery = new DomainDiscovery(mockClient as any)
    const result = await discovery.discover(singleGroup)

    expect(result.functionalAreas).toEqual(['CoreEngine'])
  })

  it('throws when all iterations return no valid areas', async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue({
        content: '{"functionalAreas": []}',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: 'test-model',
      }),
      completeJSON: vi.fn(),
      getProvider: vi.fn().mockReturnValue('google'),
      getModel: vi.fn().mockReturnValue('test-model'),
    }

    const discovery = new DomainDiscovery(mockClient as any)
    await expect(discovery.discover(sampleFileGroups)).rejects.toThrow('all iterations failed')
  })

  it('throws when all LLM calls fail', async () => {
    const mockClient = {
      complete: vi.fn().mockRejectedValue(new Error('API rate limit')),
      completeJSON: vi.fn(),
      getProvider: vi.fn().mockReturnValue('google'),
      getModel: vi.fn().mockReturnValue('test-model'),
    }

    const discovery = new DomainDiscovery(mockClient as any)
    await expect(discovery.discover(sampleFileGroups)).rejects.toThrow('all iterations failed')
  })

  it('sanitizes non-alphanumeric characters in area names', async () => {
    const mockClient = createMockLLMClient(['Data/Processing', 'user.name', '___'])

    const discovery = new DomainDiscovery(mockClient as any)
    const result = await discovery.discover(sampleFileGroups)

    // "Data/Processing" → "DataProcessing", "user.name" → "UserName", "___" → empty → filtered
    expect(result.functionalAreas).toContain('DataProcessing')
    expect(result.functionalAreas).toContain('UserName')
    expect(result.functionalAreas).not.toContain('___')
  })

  it('filters out empty strings from areas', async () => {
    const mockClient = createMockLLMClient(['Authentication', '', '  ', 'DataAccess'])

    const discovery = new DomainDiscovery(mockClient as any)
    const result = await discovery.discover(sampleFileGroups)

    expect(result.functionalAreas).toContain('Authentication')
    expect(result.functionalAreas).toContain('DataAccess')
    expect(result.functionalAreas).not.toContain('')
  })

  it('parses areas from <solution> block', async () => {
    const responseContent = '<think>Let me analyze the repository...</think>\n<solution>\n{"functionalAreas": ["GraphStorage", "SemanticAnalysis", "CLIInterface"]}\n</solution>'
    const mockClient = {
      complete: vi.fn().mockResolvedValue({
        content: responseContent,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: 'test-model',
      }),
      completeJSON: vi.fn(),
      getProvider: vi.fn().mockReturnValue('google'),
      getModel: vi.fn().mockReturnValue('test-model'),
    }

    const discovery = new DomainDiscovery(mockClient as any)
    const result = await discovery.discover(sampleFileGroups)

    expect(result.functionalAreas).toContain('GraphStorage')
    expect(result.functionalAreas).toContain('SemanticAnalysis')
    expect(result.functionalAreas).toContain('CLIInterface')
  })

  it('respects maxIterations option', async () => {
    const mockClient = createMockLLMClient(['Authentication', 'DataAccess'])

    const discovery = new DomainDiscovery(mockClient as any)
    await discovery.discover(sampleFileGroups, { maxIterations: 1 })

    expect(mockClient.complete).toHaveBeenCalledTimes(1)
  })

  it('passes repoName and repoInfo to prompt builder', async () => {
    const mockClient = createMockLLMClient(['Authentication'])

    const discovery = new DomainDiscovery(mockClient as any)
    await discovery.discover(sampleFileGroups, {
      maxIterations: 1,
      repoName: 'my-repo',
      repoInfo: 'A test repository',
      skeleton: 'src/\n  auth/',
    })

    expect(mockClient.complete).toHaveBeenCalledTimes(1)
    const [userArg] = mockClient.complete.mock.calls[0] as [string, string]
    expect(userArg).toContain('my-repo')
  })

  it('enforces maximum 8 areas from synthesis', async () => {
    const tenAreas = [
      'AreaOne',
      'AreaTwo',
      'AreaThree',
      'AreaFour',
      'AreaFive',
      'AreaSix',
      'AreaSeven',
      'AreaEight',
      'AreaNine',
      'AreaTen',
    ]
    const mockClient = createMockLLMClient(tenAreas)

    const discovery = new DomainDiscovery(mockClient as any)
    const result = await discovery.discover(sampleFileGroups, { maxIterations: 1 })

    expect(result.functionalAreas.length).toBeLessThanOrEqual(8)
  })

  it('succeeds if at least one iteration returns valid areas', async () => {
    let callCount = 0
    const mockClient = {
      complete: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({
          content: '{"functionalAreas": ["Authentication", "DataAccess"]}',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          model: 'test-model',
        })
      }),
      completeJSON: vi.fn(),
      getProvider: vi.fn().mockReturnValue('google'),
      getModel: vi.fn().mockReturnValue('test-model'),
    }

    const discovery = new DomainDiscovery(mockClient as any)
    const result = await discovery.discover(sampleFileGroups, { maxIterations: 3 })

    expect(result.functionalAreas).toContain('Authentication')
    expect(result.functionalAreas).toContain('DataAccess')
  })
})

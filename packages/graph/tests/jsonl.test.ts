import type { PythonRPG } from '../src/python-format'
import { describe, expect, it } from 'vitest'
import { parseGraphJsonl, serializeGraphJsonl } from '../src/jsonl'

const sampleGraph: PythonRPG = {
  repo_name: 'test-repo',
  repo_info: 'A test repository',
  data_flow: [
    { source: 'node-b', target: 'node-a', dataId: 'data-1', dataType: 'string' },
    { source: 'node-a', target: 'node-b', dataId: 'data-2', dataType: 'number' },
  ],
  excluded_files: ['node_modules'],
  repo_node_id: 'domain:root',
  nodes: [
    { id: 'node-b', name: 'NodeB', node_type: 'feature', level: 2, meta: { type_name: 'file', path: 'src/b.ts', description: 'Module B', content: 'export const b = 1' } },
    { id: 'node-a', name: 'NodeA', node_type: 'feature', level: 2, meta: { type_name: 'file', path: 'src/a.ts', description: 'Module A', content: 'export const a = 1' } },
  ],
  edges: [
    { src: 'node-b', dst: 'node-a', relation: 'imports', meta: null },
    { src: 'node-a', dst: 'node-b', relation: 'composes', meta: null },
  ],
  _dep_to_rpg_map: {},
  dep_graph: null,
}

describe('graph JSONL serialization', () => {
  it('serializeGraphJsonl produces valid JSONL with header on first line', () => {
    const jsonl = serializeGraphJsonl(sampleGraph)
    const lines = jsonl.split('\n')

    // header + 2 nodes + 2 edges + 2 data_flow = 7 lines
    expect(lines.length).toBe(7)

    const header = JSON.parse(lines[0]!)
    expect(header.type).toBe('header')
    expect(header.repo_name).toBe('test-repo')
    expect(header.repo_info).toBe('A test repository')
    expect(header.excluded_files).toEqual(['node_modules'])
    expect(header.repo_node_id).toBe('domain:root')
    // Header should NOT contain nodes, edges, or data_flow arrays
    expect(header.nodes).toBeUndefined()
    expect(header.edges).toBeUndefined()
    expect(header.data_flow).toBeUndefined()
  })

  it('serializeGraphJsonl sorts nodes by id', () => {
    const jsonl = serializeGraphJsonl(sampleGraph)
    const lines = jsonl.split('\n')

    // Lines 1-2 should be nodes sorted by id
    const node1 = JSON.parse(lines[1]!)
    const node2 = JSON.parse(lines[2]!)
    expect(node1.type).toBe('node')
    expect(node2.type).toBe('node')
    expect(node1.id).toBe('node-a')
    expect(node2.id).toBe('node-b')
  })

  it('serializeGraphJsonl sorts edges by (src, dst, relation)', () => {
    const jsonl = serializeGraphJsonl(sampleGraph)
    const lines = jsonl.split('\n')

    // After nodes (2), edges come next
    const edge1 = JSON.parse(lines[3]!)
    const edge2 = JSON.parse(lines[4]!)
    expect(edge1.type).toBe('edge')
    expect(edge2.type).toBe('edge')
    expect(edge1.src).toBe('node-a')
    expect(edge2.src).toBe('node-b')
  })

  it('serializeGraphJsonl sorts data_flow by (source, target, dataId)', () => {
    const jsonl = serializeGraphJsonl(sampleGraph)
    const lines = jsonl.split('\n')

    // After edges (2), data_flow lines come last
    const df1 = JSON.parse(lines[5]!)
    const df2 = JSON.parse(lines[6]!)
    expect(df1.type).toBe('data_flow')
    expect(df2.type).toBe('data_flow')
    expect(df1.source).toBe('node-a')
    expect(df2.source).toBe('node-b')
  })

  it('parseGraphJsonl round-trips without data loss', () => {
    const jsonl = serializeGraphJsonl(sampleGraph)
    const parsed = parseGraphJsonl(jsonl)

    expect(parsed.repo_name).toBe(sampleGraph.repo_name)
    expect(parsed.repo_info).toBe(sampleGraph.repo_info)
    expect(parsed.excluded_files).toEqual(sampleGraph.excluded_files)
    expect(parsed.repo_node_id).toBe(sampleGraph.repo_node_id)
    expect(parsed._dep_to_rpg_map).toEqual(sampleGraph._dep_to_rpg_map)
    expect(parsed.dep_graph).toEqual(sampleGraph.dep_graph)

    // Nodes (sorted by id)
    expect(parsed.nodes).toHaveLength(2)
    expect(parsed.nodes[0]!.id).toBe('node-a')
    expect(parsed.nodes[1]!.id).toBe('node-b')
    expect(parsed.nodes[0]!.meta?.description).toBe('Module A')

    // Edges (sorted)
    expect(parsed.edges).toHaveLength(2)
    expect(parsed.edges[0]!.src).toBe('node-a')

    // Data flow (sorted)
    expect(parsed.data_flow).toHaveLength(2)
  })

  it('parseGraphJsonl rejects empty content', () => {
    expect(() => parseGraphJsonl('')).toThrow('Empty JSONL content')
  })

  it('parseGraphJsonl rejects content without header', () => {
    expect(() => parseGraphJsonl('{"type":"node","id":"x"}')).toThrow()
  })

  it('handles graph with no nodes, edges, or data_flow', () => {
    const emptyGraph: PythonRPG = {
      repo_name: 'empty',
      repo_info: '',
      data_flow: [],
      excluded_files: [],
      repo_node_id: null,
      nodes: [],
      edges: [],
      _dep_to_rpg_map: {},
      dep_graph: null,
    }

    const jsonl = serializeGraphJsonl(emptyGraph)
    const lines = jsonl.split('\n')
    expect(lines.length).toBe(1) // header only

    const parsed = parseGraphJsonl(jsonl)
    expect(parsed.nodes).toEqual([])
    expect(parsed.edges).toEqual([])
    expect(parsed.data_flow).toEqual([])
  })

  it('each line is valid JSON', () => {
    const jsonl = serializeGraphJsonl(sampleGraph)
    const lines = jsonl.split('\n')
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })
})

import { Memory } from '@pleaseai/rpg-utils/memory'
import { describe, expect, it } from 'vitest'

describe('Memory', () => {
  describe('construction', () => {
    it('should use default contextWindow of 5', () => {
      const mem = new Memory()
      expect(mem.contextWindow).toBe(5)
    })

    it('should accept custom contextWindow', () => {
      const mem = new Memory({ contextWindow: 2 })
      expect(mem.contextWindow).toBe(2)
    })

    it('should accept contextWindow of 0 (unlimited)', () => {
      const mem = new Memory({ contextWindow: 0 })
      expect(mem.contextWindow).toBe(0)
    })

    it('should start with empty history', () => {
      const mem = new Memory()
      expect(mem.length).toBe(0)
      expect(mem.fullHistory).toEqual([])
    })
  })

  describe('message addition', () => {
    it('should add system message', () => {
      const mem = new Memory()
      mem.addSystem('You are helpful.')
      expect(mem.length).toBe(1)
      expect(mem.fullHistory[0]).toEqual({ role: 'system', content: 'You are helpful.' })
    })

    it('should add user message', () => {
      const mem = new Memory()
      mem.addUser('Hello')
      expect(mem.fullHistory[0]).toEqual({ role: 'user', content: 'Hello' })
    })

    it('should add assistant message as text part array', () => {
      const mem = new Memory()
      mem.addAssistant('Hi there')
      expect(mem.fullHistory[0]).toEqual({
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi there' }],
      })
    })

    it('should add raw ModelMessage', () => {
      const mem = new Memory()
      const msg = { role: 'user' as const, content: 'raw user message' }
      mem.addMessage(msg)
      expect(mem.fullHistory[0]).toEqual(msg)
    })

    it('should support fluent chaining', () => {
      const mem = new Memory()
      const result = mem
        .addSystem('system')
        .addUser('user1')
        .addAssistant('assistant1')
        .addUser('user2')
      expect(result).toBe(mem)
      expect(mem.length).toBe(4)
    })
  })

  describe('last()', () => {
    it('should return undefined for empty history', () => {
      expect(new Memory().last()).toBeUndefined()
    })

    it('should return the last message without role filter', () => {
      const mem = new Memory()
      mem.addSystem('sys').addUser('hello').addAssistant('world')
      expect(mem.last()).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'world' }] })
    })

    it('should return last message matching given role', () => {
      const mem = new Memory()
      mem.addSystem('sys').addUser('user1').addAssistant('asst1').addUser('user2')
      expect(mem.last('user')).toEqual({ role: 'user', content: 'user2' })
    })

    it('should return undefined when no message matches role', () => {
      const mem = new Memory()
      mem.addUser('hello')
      expect(mem.last('system')).toBeUndefined()
    })

    it('should return the first system message when only one exists', () => {
      const mem = new Memory()
      mem.addSystem('sys')
      expect(mem.last('system')).toEqual({ role: 'system', content: 'sys' })
    })
  })

  describe('sliding window trimming', () => {
    it('should return empty array for empty history', () => {
      expect(new Memory().toMessages()).toEqual([])
    })

    it('should return all messages when fewer than window allows', () => {
      const mem = new Memory({ contextWindow: 5 })
      mem.addSystem('sys').addUser('u1').addAssistant('a1').addUser('u2')
      expect(mem.toMessages()).toEqual(mem.fullHistory)
    })

    it('should preserve system message across trimming', () => {
      const mem = new Memory({ contextWindow: 1 })
      mem.addSystem('sys')
        .addUser('u1')
        .addAssistant('a1')
        .addUser('u2')
        .addAssistant('a2')
        .addUser('u3')

      const msgs = mem.toMessages()
      expect(msgs[0]).toEqual({ role: 'system', content: 'sys' })
    })

    it('should keep last N*2 middle messages', () => {
      const mem = new Memory({ contextWindow: 1 })
      mem.addSystem('sys')
        .addUser('u1')
        .addAssistant('a1')
        .addUser('u2')
        .addAssistant('a2')
        .addUser('u3')

      // contextWindow=1 → keep 2 middle messages (last pair) + last user
      const msgs = mem.toMessages()
      const roles = msgs.map(m => m.role)
      expect(roles).toEqual(['system', 'user', 'assistant', 'user'])
    })

    it('should always include the last user message', () => {
      const mem = new Memory({ contextWindow: 1 })
      mem.addSystem('sys')
        .addUser('u1')
        .addAssistant('a1')
        .addUser('u2')
        .addAssistant('a2')
        .addUser('last-user')

      const msgs = mem.toMessages()
      const last = msgs[msgs.length - 1]
      expect(last).toEqual({ role: 'user', content: 'last-user' })
    })

    it('should not treat last assistant message as "last user"', () => {
      const mem = new Memory({ contextWindow: 1 })
      mem.addSystem('sys')
        .addUser('u1')
        .addAssistant('a1')
        .addUser('u2')
        .addAssistant('a2')

      // Last msg is assistant — no "last user" special treatment
      const msgs = mem.toMessages()
      expect(msgs[msgs.length - 1].role).toBe('assistant')
    })

    it('should handle contextWindow=2 correctly', () => {
      const mem = new Memory({ contextWindow: 2 })
      // Build 3 pairs
      mem.addSystem('sys')
        .addUser('u1')
        .addAssistant('a1')
        .addUser('u2')
        .addAssistant('a2')
        .addUser('u3')
        .addAssistant('a3')
        .addUser('u4')

      // contextWindow=2 → keep last 4 middle messages (2 pairs) + last user
      const msgs = mem.toMessages()
      const roles = msgs.map(m => m.role)
      expect(roles).toEqual(['system', 'user', 'assistant', 'user', 'assistant', 'user'])
    })

    it('should return unlimited messages when contextWindow=0', () => {
      const mem = new Memory({ contextWindow: 0 })
      for (let i = 0; i < 10; i++) {
        mem.addUser(`u${i}`).addAssistant(`a${i}`)
      }
      expect(mem.toMessages().length).toBe(20)
    })

    it('should handle no system message', () => {
      const mem = new Memory({ contextWindow: 1 })
      mem.addUser('u1').addAssistant('a1').addUser('u2').addAssistant('a2').addUser('u3')

      const msgs = mem.toMessages()
      const roles = msgs.map(m => m.role)
      // No system → [u2, a2, u3]
      expect(roles).toEqual(['user', 'assistant', 'user'])
    })

    it('history getter returns same as toMessages()', () => {
      const mem = new Memory({ contextWindow: 1 })
      mem.addSystem('sys').addUser('u1').addAssistant('a1').addUser('u2')
      expect(mem.history).toEqual(mem.toMessages())
    })
  })

  describe('clear()', () => {
    it('should reset history to empty', () => {
      const mem = new Memory()
      mem.addSystem('sys').addUser('hello')
      expect(mem.length).toBe(2)

      mem.clear()
      expect(mem.length).toBe(0)
      expect(mem.fullHistory).toEqual([])
    })
  })

  describe('length', () => {
    it('should reflect total number of messages in full history', () => {
      const mem = new Memory({ contextWindow: 1 })
      // Add more messages than window allows
      mem.addSystem('s').addUser('u1').addAssistant('a1').addUser('u2').addAssistant('a2')
      expect(mem.length).toBe(5)
      // toMessages() is trimmed but length tracks full history
      expect(mem.toMessages().length).toBeLessThan(5)
    })
  })
})

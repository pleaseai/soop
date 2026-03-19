import type { ExperimentConfig } from '@vercel/agent-eval'
import { setupSoop } from '../lib/setup-soop.js'

export default {
  agent: 'gemini',
  model: 'gemini-3-flash-preview',
  sandbox: 'docker',
  timeout: 600,
  runs: 3,
  earlyExit: true,
  setup: setupSoop,
} satisfies ExperimentConfig

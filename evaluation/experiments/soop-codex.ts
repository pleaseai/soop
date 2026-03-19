import type { ExperimentConfig } from '@vercel/agent-eval'
import { setupSoop } from '../lib/setup-soop.js'

export default {
  agent: 'codex',
  model: 'opus',
  sandbox: 'docker',
  timeout: 600,
  runs: 3,
  earlyExit: true,
  setup: setupSoop,
} satisfies ExperimentConfig

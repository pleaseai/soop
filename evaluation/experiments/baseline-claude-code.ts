import type { ExperimentConfig } from '@vercel/agent-eval'

export default {
  agent: 'claude-code',
  model: 'opus',
  sandbox: 'docker',
  timeout: 600,
  runs: 3,
  earlyExit: true,
} satisfies ExperimentConfig

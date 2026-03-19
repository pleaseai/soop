import type { ExperimentConfig } from '@vercel/agent-eval'

export default {
  agent: 'gemini',
  model: 'gemini-3-flash-preview',
  sandbox: 'docker',
  timeout: 600,
  runs: 3,
  earlyExit: true,
} satisfies ExperimentConfig

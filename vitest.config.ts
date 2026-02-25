import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/tests/**/*.test.ts'],
    exclude: ['tests/fixtures/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/cli/src/cli.ts'],
    },
    testTimeout: 10000,
    server: {
      deps: {
        external: [],
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['packages/*/tests/**/*.test.ts'],
          exclude: ['tests/fixtures/**', 'packages/*/tests/**/*.integration.test.ts'],
          testTimeout: 15000,
        },
      },
      {
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          include: ['packages/*/tests/**/*.integration.test.ts'],
          exclude: ['tests/fixtures/**'],
          testTimeout: 30000,
        },
      },
    ],
  },
})

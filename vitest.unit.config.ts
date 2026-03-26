import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/orchestrator-study.test.ts', 'tests/spaced-repetition.test.ts'],
  },
});

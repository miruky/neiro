import { defineConfig } from 'vitest/config';

// GitHub Pagesではリポジトリ名のサブパスで配信されるためbaseを差し替える
export default defineConfig({
  base: process.env.NEIRO_BASE ?? '/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

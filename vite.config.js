export default {
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.js'],
      exclude: ['src/styles/**', 'src/purify.min.js', 'src/marked.umd.js'],
      thresholds: {
        statements: 20,
        branches: 15,
        functions: 15,
        lines: 20,
      }
    }
  }
}

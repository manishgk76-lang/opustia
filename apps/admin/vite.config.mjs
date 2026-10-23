export default {
  esbuild: {
    jsx: 'automatic'
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
}

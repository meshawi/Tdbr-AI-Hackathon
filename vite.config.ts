import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    // Data pipelines write thousands of files here; watching them starves the dev server.
    watch: { ignored: ['**/.cache/**', '**/data/**', '**/scripts/**', '**/rag/**', '**/HackathonReglationsAndDetials/**'] },
    // The chat and retrieval API is the Python service in rag/ (uvicorn on 8000).
    proxy: { '/api': { target: process.env.RAG_API_URL || 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  build: { target: 'es2020', sourcemap: false },
});

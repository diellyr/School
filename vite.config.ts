/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Em produção o app é publicado no GitHub Pages como "project page"
// (https://<usuario>.github.io/School/), então os assets precisam do prefixo
// "/School/". Em desenvolvimento mantemos a raiz "/" para não atrapalhar o dev server.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/School/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}))

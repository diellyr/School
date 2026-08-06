/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { APP_VERSION } from './src/app/version.ts'

// Grava version.json no build de produção, para o UpdateChecker (src/app/UpdateChecker.tsx)
// detectar quando o navegador está com uma versão antiga do app em cache.
function versionFilePlugin(): Plugin {
  return {
    name: 'version-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION }) });
    },
  };
}

// Em produção o app é publicado no GitHub Pages como "project page"
// (https://<usuario>.github.io/School/), então os assets precisam do prefixo
// "/School/". Em desenvolvimento mantemos a raiz "/" para não atrapalhar o dev server.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/School/' : '/',
  plugins: [react(), tailwindcss(), versionFilePlugin()],
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

/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { offline } from './pwa/offline-plugin.ts'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), offline({ template: fileURLToPath(new URL('./pwa/sw.template.js', import.meta.url)) })],
  test: { environment: 'node', setupFiles: ['tests/setup.ts'], include: ['tests/**/*.test.{ts,tsx}'] },
})

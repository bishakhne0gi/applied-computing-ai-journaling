import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // The repo-root env file holds the VITE_* vars; without this Vite only looks inside frontend/.
  envDir: '..',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Same paths nginx proxies in Compose, so `VITE_API_MOCKS=off pnpm dev` works against `make dev-backend`.
  server: { proxy: { '/api': 'http://localhost:8000', '/health': 'http://localhost:8000' } },
})

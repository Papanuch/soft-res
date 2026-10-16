import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// L'interface compilée est servie par le moteur Python (soft_res/static).
// En développement : `uv run soft-res --serveur` (port 8765) puis `npm run dev`.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: '../soft_res/static', emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:8765' } },
})

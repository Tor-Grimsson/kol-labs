import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import posterApiPlugin from './server/poster/vite-api-plugin.js'
import videoApiPlugin from './server/video/vite-api-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  // posterApiPlugin: dev/preview middleware — /api/poster/* (ffmpeg/magick
  // backend) + /workspace/* (poster's gitignored working files).
  // videoApiPlugin: /api/video/* (ffmpeg trim/crop) + /api/video/file/* clips.
  plugins: [react(), svgr(), tailwindcss(), posterApiPlugin(), videoApiPlugin()],
  // Workspace hoisting can leave two physical React copies in the tree
  // (root vs app node_modules), which crashes at runtime with a null
  // dispatcher. Force a single react / react-dom copy.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true,
  },
})

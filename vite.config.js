import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import posterApiPlugin from './server/poster/vite-api-plugin.js'
import videoApiPlugin from './server/video/vite-api-plugin.js'
import libraryApiPlugin from './server/library/vite-api-plugin.js'
import galleryApiPlugin from './server/gallery/vite-api-plugin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (empty prefix) so the server-side library proxy can read
  // ADMIN_PASSWORD from .env.local — it's never exposed to the client.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // posterApiPlugin: dev/preview middleware — /api/poster/* (ffmpeg/magick
    // backend) + /workspace/* (poster's gitignored working files).
    // videoApiPlugin: /api/video/* (ffmpeg trim/crop) + /api/video/file/* clips.
    // libraryApiPlugin: /api/library/upload → kol-media admin (Basic auth, dev).
    // galleryApiPlugin: /api/gallery/save → writes public/images + manifest (dev).
    plugins: [
      react(), svgr(), tailwindcss(),
      posterApiPlugin(), videoApiPlugin(),
      libraryApiPlugin(env.ADMIN_PASSWORD), galleryApiPlugin(),
    ],
    // Workspace hoisting can leave two physical React copies in the tree
    // (root vs app node_modules), which crashes at runtime with a null
    // dispatcher. Force a single react / react-dom copy.
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    // /media → kol-media CDN, same-origin so canvas effects don't taint (the CDN
    // sends no CORS header). Mirrored in vercel.json for prod.
    server: {
      host: true,
      proxy: {
        '/media': { target: 'https://media.kolkrabbi.io', changeOrigin: true, rewrite: (p) => p.replace(/^\/media/, '') },
      },
    },
    preview: {
      proxy: {
        '/media': { target: 'https://media.kolkrabbi.io', changeOrigin: true, rewrite: (p) => p.replace(/^\/media/, '') },
      },
    },
  }
})

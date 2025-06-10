import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs';

console.log('VITE vite.config.ts process.env.VITE_RENDER:', process.env.VITE_RENDER);

const isRender = process.env.VITE_RENDER === 'true';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    ...(isRender
      ? {} // On Render, use HTTP (no https property)
      : {
          https: {
            key: fs.readFileSync('../backend/key.pem'),
            cert: fs.readFileSync('../backend/cert.pem'),
          },
        }),
    port: 5173, // or your preferred port
  },
});


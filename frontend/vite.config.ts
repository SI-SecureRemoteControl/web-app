import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import fs from 'fs';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    https: {
      key: fs.readFileSync('../backend/key.pem'),
      cert: fs.readFileSync('../backend/cert.pem'),
    },
    port: 5173, // or your preferred port
  },
});


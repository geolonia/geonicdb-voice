import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/geonicdb-voice/',
  plugins: [react()],
  server: {
    proxy: {
      '/ngsi-ld': 'https://geonicdb.geolonia.com',
    },
  },
})

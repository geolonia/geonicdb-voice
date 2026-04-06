import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ngsi-ld': 'https://geonicdb.geolonia.com',
      '/version': 'https://geonicdb.geolonia.com',
      '/custom-data-models': 'https://geonicdb.geolonia.com',
      '/auth': 'https://geonicdb.geolonia.com',
      '/oauth': 'https://geonicdb.geolonia.com',
      '/me': 'https://geonicdb.geolonia.com',
      '/sdk': 'https://geonicdb.geolonia.com',
    },
  },
})

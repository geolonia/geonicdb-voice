import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/` : '/',
    plugins: [react()],
    server: {
      port: 8080,
      proxy: {
        '/ngsi-ld': env.VITE_GEONICDB_URL || 'https://geonicdb.geolonia.com',
      },
    },
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')
)

const commitHash = (
  process.env.GITHUB_SHA ||
  process.env.COMMIT_REF ||
  ''
).slice(0, 7)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(`v${packageJson.version}`),
    __BUILD_DATE__: JSON.stringify(new Date().toLocaleDateString('pt-BR')),
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
})


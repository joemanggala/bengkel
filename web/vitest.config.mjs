// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    // tsconfig memakai jsx "preserve" untuk Next.js; tes komponen (.tsx) butuh JSX yang
    // langsung diubah menjadi panggilan React.
    esbuild: { jsx: 'automatic' },
    test: { include: ['src/**/__tests__/**/*.test.{ts,tsx}'], environment: 'node' },
})

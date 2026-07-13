import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
    base: '/BushidOS/',
    build: {
        rollupOptions: {
            input: {
                katanaMode: resolve(__dirname, 'katanaMode.html'),
            },
        },
    },
})

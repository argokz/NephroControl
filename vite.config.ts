/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // Относительные пути к ресурсам: сборка работает в подпути (https://itwin.kz/nephrocontrol/).
  base: './',
  plugins: [vue()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});

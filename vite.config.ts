import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base './' 讓 GitHub Pages 任何 repo 名稱都能用
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});

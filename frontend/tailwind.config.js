// Tailwind v4 uses CSS-first configuration (see src/index.css: `@import "tailwindcss"`).
// This file is kept for tooling/editor discovery and future theme extension.
// Content sources are auto-detected by the @tailwindcss/vite plugin.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}

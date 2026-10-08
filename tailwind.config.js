/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f3efe6',
        card: '#faf7f0',
        ink: {
          DEFAULT: '#1d1b17',
          soft: '#4a463e',
          faint: '#8a8477',
        },
        rule: '#d6cfbf',
        signal: '#d9421c',
        ok: '#2f6f4e',
        warn: '#b7791f',
        tide: '#2b5d7c',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

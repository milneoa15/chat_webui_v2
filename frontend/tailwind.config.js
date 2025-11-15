import { fontFamily } from 'tailwindcss/defaultTheme'
import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', ...fontFamily.sans],
        mono: ['"IBM Plex Mono"', ...fontFamily.mono],
      },
      colors: {
        graphite: {
          50: '#f2f2f5',
          100: '#d9d9e0',
          200: '#bfbfcc',
          300: '#a6a6b8',
          400: '#8c8ca3',
          500: '#73738f',
          600: '#595973',
          700: '#404057',
          800: '#26263b',
          900: '#0d0d1f',
        },
      },
    },
  },
  plugins: [typography()],
}

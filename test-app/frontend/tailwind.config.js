/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gene: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#8190ff',
          500: '#6d7cff',
          600: '#5b68f6',
          700: '#4b56d9',
          800: '#3d46b3',
          900: '#31388c',
          950: '#0b1020'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      boxShadow: {
        glow: '0 20px 80px rgba(109, 124, 255, 0.18)'
      },
    },
  },
  plugins: [],
};

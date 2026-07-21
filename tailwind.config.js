/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,jsx,js}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Lexend', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        ink: '#161328',
        brand: {
          50: '#eef0ff', 100: '#e0e3ff', 200: '#c6caff', 300: '#a3a8ff', 400: '#8489fb',
          500: '#655ff0', 600: '#5245e0', 700: '#4536bf', 800: '#392e99', 900: '#241f5e',
        },
      },
    },
  },
  plugins: [],
};

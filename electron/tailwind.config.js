/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7ccbfc',
          400: '#36b3f8',
          500: '#0c99e9',
          600: '#0079c7',
          700: '#0161a1',
          800: '#065285',
          900: '#0b446e',
        },
      },
    },
  },
  plugins: [],
}

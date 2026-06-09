/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#070b1a',
        'nw-red':   '#E31E24',
        'nw-navy':  '#131B2E',
        'nw-dark':  '#0D1018',
      },
      fontFamily: {
        display: ['Oswald', 'Inter', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

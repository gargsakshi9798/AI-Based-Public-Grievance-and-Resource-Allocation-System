/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0c2340',
        saffron: '#ff9933',
        india: '#138808',
        gold: '#b08d57',
        paper: '#f6f3ec',
      },
      fontFamily: {
        serif: ['"Libre Baskerville"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

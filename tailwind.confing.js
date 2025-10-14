/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        header: '#D9D9D9',
        test: '#f00000',
      },
      fontFamily: {
        fixel: ['Fixel Text', 'sans-serif'],
        'fixel-display': ['Fixel Display', 'sans-serif'],
        'fixel-var': ['Fixel Var', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

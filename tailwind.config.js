/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ladelos: {
          azul: '#1B3BAA',
          naranja: '#FF9900',
        },
      },
    },
  },
  plugins: [],
}

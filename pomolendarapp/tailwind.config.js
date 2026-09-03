// tailwind.config.js
const plugin = require('tailwindcss/plugin');

module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Unkempt-Regular'],
      },
    },
  },
  plugins: [
    plugin(function({ addUtilities }) {
      addUtilities({
        '.font-bold': {
          fontFamily: 'Unkempt-Bold',
          fontWeight: 'normal',
        },
        '.font-semibold': {
          fontFamily: 'Unkempt-Bold',
          fontWeight: 'normal',
        },
        '.font-medium': {
          fontFamily: 'Unkempt-Bold',
          fontWeight: 'normal',
        },
      })
    })
  ],
}
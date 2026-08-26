/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#075E54', light: '#128C7E', dark: '#054a42' },
        accent: { DEFAULT: '#25D366', hover: '#1da851' },
        chat: { bg: '#efeae2', bubbleOut: '#dcf8c6', bubbleIn: '#ffffff' },
        surface: { DEFAULT: '#ffffff', hover: '#f5f6f6', active: '#e9ebeb' },
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-once': 'pulse 1s ease-in-out 1',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

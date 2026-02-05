/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "hb-bg": "#f8fafc",
        "hb-card": "#ffffff",
        "hb-primary": "#6B64F2",
        "hb-accent": "#16a34a"
      }
    }
  },
  plugins: []
};



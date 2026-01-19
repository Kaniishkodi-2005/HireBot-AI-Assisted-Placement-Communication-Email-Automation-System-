/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "hb-bg": "#f8fafc",
        "hb-card": "#ffffff",
        "hb-primary": "#2563eb",
        "hb-accent": "#16a34a"
      }
    }
  },
  plugins: []
};



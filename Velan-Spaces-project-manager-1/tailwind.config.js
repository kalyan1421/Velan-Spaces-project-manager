/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "sans-serif"],
        serif: ['"Playfair Display"', "serif"],
      },
      colors: {
        primary: "#000000",
        secondary: "#404040",
        accent: "#F9E768",
        "accent-hover": "#eac100",
        surface: "#FFFFFF",
        "surface-alt": "#FAFAFA",
      },
      boxShadow: {
        velan: "0 4px 20px -2px rgba(249, 231, 104, 0.15)",
        card: "0 2px 10px rgba(0, 0, 0, 0.03)",
      },
    },
  },
  plugins: [],
};

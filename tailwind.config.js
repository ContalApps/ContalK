/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          bg: "#36393f",
          sidebar: "#2f3136",
          server: "#202225",
          accent: "#5865F2",
          text: "#dcddde",
          muted: "#72767d",
          hover: "#4f545c"
        }
      }
    },
  },
  plugins: [],
}
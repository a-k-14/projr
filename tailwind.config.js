/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1B4332",
          light: "#2D6A4F",
          dark: "#0A2618",
        },
        income: "#16A34A",
        expense: "#DC2626",
        transfer: "#1E293B",
        loan: "#B45309",
        background: {
          DEFAULT: "#F0F0F5",
          card: "#FFFFFF",
        },
        text: {
          primary: "#0A0A0A",
          secondary: "#6B7280",
          muted: "#9CA3AF",
        },
        border: "#E5E7EB",
      },
    },
  },
  plugins: [],
};

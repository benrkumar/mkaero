/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          950: "#07090F",
          900: "#0A0D1A",
          800: "#0F1220",
          700: "#161B2E",
          600: "#1C2238",
          500: "#232942",
          400: "#2C334A",
          300: "#3D4560",
          200: "#515A78",
          100: "#8896B0",
          50:  "#C5CEDF",
        },
        drone: {
          blue:   "#0EA5E9",
          orange: "#F97316",
          green:  "#10B981",
          red:    "#EF4444",
          purple: "#7C3AED",
          violet: "#6366F1",
        },
      },
      backgroundImage: {
        "gradient-drone":  "linear-gradient(135deg, #7C3AED 0%, #0EA5E9 100%)",
        "gradient-orange": "linear-gradient(135deg, #F97316 0%, #EF4444 100%)",
        "gradient-green":  "linear-gradient(135deg, #10B981 0%, #0EA5E9 100%)",
        "gradient-card":   "linear-gradient(135deg, #161B2E 0%, #1C2238 100%)",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

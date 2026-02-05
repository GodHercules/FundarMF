import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
      "3xl": "1920px"
    },
    extend: {
      fontFamily: {
        display: ["\"Merriweather\"", "serif"],
        body: ["\"Work Sans\"", "sans-serif"]
      },
      colors: {
        ink: "#0e1a2b",
        paper: "#f8f4ef",
        canvas: "#f4efe8",
        ledger: "#e8edf3",
        brass: "#2f6bff",
        emerald: "#2f9b79",
        clay: "#d97063",
        navy: "#0b1424",
        slate: "#4b5f78",
        sand: "#e7dccb",
        gold: "#d1a34a",
        steel: "#90a4b8"
      },
      boxShadow: {
        soft: "0 22px 50px rgba(14, 26, 43, 0.12)",
        glow: "0 0 0 3px rgba(47, 107, 255, 0.2)",
        lift: "0 10px 26px rgba(14, 26, 43, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;

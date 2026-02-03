import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["\"Merriweather\"", "serif"],
        body: ["\"Work Sans\"", "sans-serif"]
      },
      colors: {
        ink: "#0b1f3a",
        paper: "#f7fbff",
        ledger: "#e6f0ff",
        brass: "#2d6cdf",
        emerald: "#1b7ed6",
        navy: "#0a1730",
        clay: "#d65c5c",
        sky: "#4b93ff",
        slate: "#4a617a"
      },
      boxShadow: {
        soft: "0 18px 40px rgba(11, 31, 58, 0.12)",
        glow: "0 0 0 3px rgba(45, 108, 223, 0.2)"
      }
    }
  },
  plugins: []
};

export default config;

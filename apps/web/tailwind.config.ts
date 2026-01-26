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
        ink: "#1b2533",
        paper: "#f7f2e9",
        ledger: "#e9e2d6",
        brass: "#c8a14a",
        emerald: "#1f7a5c",
        navy: "#0d1b2a",
        clay: "#c97c5d",
        sky: "#7cb7cc",
        slate: "#475569"
      },
      boxShadow: {
        soft: "0 12px 30px rgba(13, 27, 42, 0.12)",
        glow: "0 0 0 3px rgba(200, 161, 74, 0.25)"
      }
    }
  },
  plugins: []
};

export default config;

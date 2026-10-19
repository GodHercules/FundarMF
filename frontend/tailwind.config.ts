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
        ink: "#121a29",
        paper: "#f8f9fb",
        canvas: "#edf0f4",
        ledger: "#f3f5f8",
        brass: "#315efb",
        emerald: "#177a5b",
        clay: "#c45252",
        navy: "#172235",
        slate: "#4b5f78",
        sand: "#e5e9ef",
        gold: "#b97b21",
        steel: "#8d98a8",
        cream: "#f3f5f8"
      },
      boxShadow: {
        soft: "0 12px 28px rgba(18, 26, 41, 0.12)",
        glow: "0 0 0 3px rgba(49, 94, 251, 0.2)",
        lift: "0 8px 18px rgba(18, 26, 41, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;

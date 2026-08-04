import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#090806",
          secondary: "#100e0c",
        },
        surface: {
          DEFAULT: "#15120f",
          elevated: "#1c1814",
          soft: "#211c17",
          glass: "rgba(21, 18, 15, 0.75)",
        },
        border: {
          DEFAULT: "#332c25",
          subtle: "#25201c",
          glow: "rgba(180, 122, 70, 0.25)",
        },
        text: {
          primary: "#f0e7d8",
          secondary: "#b8ab9b",
          muted: "#776d62",
        },
        accent: {
          DEFAULT: "#b47a46",
          hover: "#c58b55",
          gold: "#c59a60",
          copper: "#9f603e",
          burgundy: "#602d2d",
          glow: "rgba(180, 122, 70, 0.15)",
        },
        status: {
          success: "#72956b",
          warning: "#c59a60",
          error: "#b06055",
        },
        rank: {
          gold: "#c59a60",
          silver: "#b8ab9b",
          bronze: "#9f603e",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Geist", "Inter", "sans-serif"],
        serif: ["var(--font-instrument-serif)", "Instrument Serif", "Georgia", "serif"],
      },
      boxShadow: {
        glow: "0 0 30px -5px rgba(180, 122, 70, 0.2)",
        card: "0 8px 30px -4px rgba(0, 0, 0, 0.6)",
        magazine: "0 20px 40px -10px rgba(0, 0, 0, 0.8)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 20s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;


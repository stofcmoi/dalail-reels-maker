import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070a12",
        panel: "#0b1020",
        gold: "#F5D37D"
      }
    }
  },
  plugins: []
} satisfies Config;

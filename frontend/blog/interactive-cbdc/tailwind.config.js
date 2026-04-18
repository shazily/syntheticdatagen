import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./part-*.html",
    "./src/**/*.{js,jsx}",
    "../../../docs/agentic-api-series/interactive-cbdc-blog/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        moveRight: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(400%)" },
        },
      },
      animation: {
        moveRight: "moveRight 1s linear infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Jetons sémantiques du référentiel Juridesk (valeurs dans app/globals.css, clair et sombre)
        bg: "var(--bg)",
        panel: "var(--panel)",
        panel2: "var(--panel2)",
        line: "var(--line)",
        chip: "var(--chip)",
        hl: "var(--hl)",
        ink: "var(--ink)",
        mut: "var(--mut)",
        titre: "var(--titre)",
        acc: "var(--acc)",
        "acc-ink": "var(--acc-ink)",
        btn: "var(--btn)",
        "btn-ink": "var(--btn-ink)",
        th: "var(--th)",
        "th-ink": "var(--th-ink)",
        ok: "var(--ok)",
        "ok-bg": "var(--ok-bg)",
        warn: "var(--warn)",
        "warn-bg": "var(--warn-bg)",
        bad: "var(--bad)",
        "bad-bg": "var(--bad-bg)",
        // Bleu marine de marque (logos AGL : #1C3359 / #1D3259)
        marine: {
          50: "#f2f5f9",
          100: "#e3e9f1",
          200: "#c3cfde",
          300: "#9aacc4",
          400: "#6c82a3",
          500: "#465e82",
          600: "#2e4668",
          700: "#233a5a",
          800: "#1c3359",
          900: "#152743",
          950: "#0c1830",
        },
        // Jaune or du logo (#E8D08D)
        gold: {
          100: "#faf5e6",
          200: "#f4e9c4",
          300: "#e8d08d",
          400: "#dcba66",
          500: "#c99f47",
        },
      },
    },
  },
  plugins: [],
};
export default config;

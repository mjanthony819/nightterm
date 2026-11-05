module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0B0C", panel: "#111113", line: "#232326", "line-soft": "#2E2E33",
        ink: "#FFFFFF", body: "#D8D8DC", dim: "#9A9AA2", faint: "#6B6B73",
        blue: "#C6F432", "blue-deep": "#7FA11C", up: "#4fd1a0", down: "#ff6b7a", amber: "#e8b24a",
      },
      fontFamily: {
        serif: ["'Instrument Serif'", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        pixel: ["Inter", "system-ui", "sans-serif"],
        doto: ["Doto", "monospace"],
        mono: ["'Space Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

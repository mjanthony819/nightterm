module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0E0607", panel: "#150A0B", line: "#2A1516", "line-soft": "#33201F",
        ink: "#FFFFFF", body: "#D8D8DC", dim: "#9A9AA2", faint: "#6B6B73",
        blue: "#FEED65", "blue-deep": "#E13A26", up: "#4fd1a0", down: "#ff6b7a", amber: "#e8b24a",
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

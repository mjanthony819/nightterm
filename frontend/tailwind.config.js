module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05080f", panel: "#070c16", line: "#14202f", "line-soft": "#1a2839",
        ink: "#dde6f2", body: "#bcc8d9", dim: "#8494a9", faint: "#54637a",
        blue: "#3aa4ff", "blue-deep": "#1663b8", up: "#4fd1a0", down: "#ff6b7a", amber: "#e8b24a",
      },
      fontFamily: {
        pixel: ["'Press Start 2P'", "monospace"],
        doto: ["Doto", "monospace"],
        mono: ["'Space Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

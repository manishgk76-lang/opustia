/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F0FDFA",
          100: "#CCFBF1",
          500: "#0F766E",
          600: "#0B5E58",
          700: "#115E59",
          900: "#134E4A"
        },
        ink: "#102A43"
      }
    }
  },
  plugins: []
};

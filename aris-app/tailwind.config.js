/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./constants/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#FBF8FF",
        surface: "#FFFFFF",
        "surface-lavender": "#F1ECFF",
        lavender: "#7C5CFC",
        "lavender-dark": "#5B43D6",
        sky: "#83C7F5",
        ink: "#191936",
        "secondary-text": "#686985",
        success: "#1AA879",
        caution: "#E99A22",
        danger: "#E65B65",
        info: "#448DEB",
        border: "#E9E5F3",
      },
      fontFamily: {
        "heading": ["Poppins_600SemiBold"],
        "heading-bold": ["Poppins_700Bold"],
        "body": ["Inter_400Regular"],
        "body-medium": ["Inter_500Medium"],
        "body-semibold": ["Inter_600SemiBold"],
      },
      spacing: {
        "xs": "4px",
        "sm": "8px",
        "md": "12px",
        "lg": "16px",
        "xl": "20px",
        "2xl": "24px",
        "3xl": "32px",
      },
    },
  },
  plugins: [],
};

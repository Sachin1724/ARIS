/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./constants/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#F8FAFC",
        surface: "#FFFFFF",
        "surface-lavender": "#F1F5F9",
        lavender: "#2563EB",
        "lavender-dark": "#1D4ED8",
        sky: "#0EA5E9",
        ink: "#0F172A",
        "secondary-text": "#64748B",
        success: "#10B981",
        caution: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
        border: "#E2E8F0",
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

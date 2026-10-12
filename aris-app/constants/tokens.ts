export const colors = {
  // Neutral technical background and surfaces (no purple tints)
  background: "#F8FAFC", // Clean off-white slate-50
  surface: "#FFFFFF",
  surfaceMuted: "#F1F5F9", // Crisp slate-100
  
  // Hardware/Instrument primary identity (solid deep slate, not purple gradient)
  primary: "#0F172A", // Slate-900
  primaryDark: "#020617", // Slate-950
  accent: "#2563EB", // Engineering blue-600
  accentDark: "#1D4ED8", // Blue-700
  accentLight: "#EFF6FF", // Blue-50

  // High contrast typography
  ink: "#0F172A",
  secondaryText: "#64748B", // Slate-500
  mutedText: "#94A3B8", // Slate-400

  // Standard environmental metric statuses
  success: "#10B981", // Emerald-500 (Good air quality)
  successLight: "#ECFDF5",
  caution: "#F59E0B", // Amber-500 (Moderate air quality)
  cautionLight: "#FFFBEB",
  danger: "#EF4444", // Red-500 (Unhealthy air quality)
  dangerLight: "#FEF2F2",
  info: "#3B82F6", // Blue-500
  infoLight: "#EFF6FF",

  // Crisp technical borders
  border: "#E2E8F0", // Slate-200
  borderLight: "#F1F5F9",
  card: "#FFFFFF",

  // Aliases for legacy component compatibility, mapped to technical blue & neutral surfaces
  lavender: "#2563EB",
  lavenderDark: "#1D4ED8",
  surfaceLavender: "#F1F5F9",
  sky: "#0EA5E9",
} as const;

export const fonts = {
  heading: "Poppins_600SemiBold",
  headingBold: "Poppins_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
} as const;

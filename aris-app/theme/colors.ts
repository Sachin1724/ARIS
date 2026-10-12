/**
 * ARIS Theme Color Tokens
 * Dark theme with tactical neon-lime accents.
 */

export const colors = {
  // Navigation Bar Specific Tokens
  navBackground: "#111511",
  navBorder: "#303630",
  navSelectedBackground: "#252D1E",
  navSelected: "#D7FF43",
  navInactive: "#8B928A",
  
  // App Core Text & Backgrounds
  primaryText: "#F5F7F2",
  secondaryText: "#8B928A",
  mutedText: "#5F665E",
  background: "#0D110E",
  surface: "#141A15",
  surfaceMuted: "#1B221C",
  card: "#171E18",
  border: "#303630",
  borderLight: "#232A24",

  // Brand Accent (Neon Lime)
  accent: "#D7FF43",
  accentMuted: "#A8CC2D",
  accentGlow: "rgba(215, 255, 67, 0.15)",

  // Environmental Status Indicators
  statusGood: "#D7FF43",
  statusModerate: "#EAB308",
  statusSensitive: "#F97316",
  statusUnhealthy: "#EF4444",

  // Common UI State Colors
  danger: "#EF4444",
  warning: "#F59E0B",
  success: "#10B981",
  info: "#38BDF8",
} as const;

export type ThemeColors = typeof colors;

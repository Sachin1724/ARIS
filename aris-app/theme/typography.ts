/**
 * ARIS Typography Tokens
 * Standardized on Inter across all text hierarchies.
 */

export const typography = {
  fontFamilies: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semiBold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },
  navLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  heading1: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    lineHeight: 30,
  },
  heading2: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    lineHeight: 26,
  },
  heading3: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
} as const;

export type TypographyTokens = typeof typography;

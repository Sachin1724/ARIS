# Design System

## Visual direction
Soft premium mascot-led environmental companion: fluffy lavender character, warm white surfaces, lavender/sky-blue accents, restrained gradients, rounded cards and generous whitespace. Avoid generic IoT dashboard styling.

## Typography
- Poppins: display titles, headings, key readings and prominent buttons.
- Inter: body text, labels, charts, forms, status and explanations.
- Bundle fonts locally with a compatible Expo font setup and fallback fonts.

## Tokens
```ts
export const colors = {
  background: "#FBF8FF", surface: "#FFFFFF",
  surfaceLavender: "#F1ECFF", lavender: "#7C5CFC",
  lavenderDark: "#5B43D6", sky: "#83C7F5",
  ink: "#191936", secondaryText: "#686985",
  success: "#1AA879", caution: "#E99A22",
  danger: "#E65B65", info: "#448DEB", border: "#E9E5F3"
};
```
Use a 4-point spacing base (4, 8, 12, 16, 20, 24, 32). Target touch areas around 44–48 dp. Use text/icon as well as color for statuses. AQI thresholds must come from a documented standard. Keep charts legible and label observed vs predicted. Gradients emphasize one focal area; avoid stacking shadows on every nested card.

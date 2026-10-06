export const palette = {
  paper: "#F7F3EC",
  paperDeep: "#ECE4D3",
  cream: "#FCF9F3",
  linen: "#E5DCC8",
  surface: "#FFFFFF",
  ink: "#1C1917",
  inkSoft: "#44403C",
  muted: "#8A8178",
  line: "#E5DCC8",
  bronze: "#9A7B4F",
  bronzeDeep: "#6E5733",
  bronzeSoft: "#C9A876",
  clay: "#B4654A",
  moss: "#6F7557",
  blush: "#E7CFC0",
  danger: "#A8382A",
  success: "#3E6B4F",
  onBronze: "#FFFFFF",
} as const;

export const fonts = {
  display: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_400Regular_Italic",
  body: "SpaceGrotesk_400Regular",
  bodyMedium: "SpaceGrotesk_500Medium",
  bodySemiBold: "SpaceGrotesk_600SemiBold",
  bodyBold: "SpaceGrotesk_700Bold",
} as const;

export const fontStyles = {
  display: { fontFamily: fonts.display },
  displayItalic: { fontFamily: fonts.displayItalic },
  body: { fontFamily: fonts.body },
  bodyMedium: { fontFamily: fonts.bodyMedium },
  bodySemiBold: { fontFamily: fonts.bodySemiBold },
  bodyBold: { fontFamily: fonts.bodyBold },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
} as const;

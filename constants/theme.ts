export const darkColors = {
  ink: "#070A12",
  panel: "#11182A",
  panelSoft: "#151D31",
  ivory: "#F8FAFC",
  muted: "#94A3B8",
  gold: "#F6C453",
  electric: "#3F7CFF",
  magenta: "#D83CA6",
  bronze: "#64748B",
  jade: "#34D399",
  plum: "#7C3AED",
  wine: "#FB7185",
  navy: "#0B1020",
  line: "rgba(255, 255, 255, 0.08)",
  glass: "rgba(8, 12, 24, 0.82)"
};

export const lightColors = {
  ink: "#293142",
  panel: "#374154",
  panelSoft: "#465167",
  ivory: "#FFF9EE",
  muted: "#CBD3DF",
  gold: "#F0C875",
  electric: "#769BEB",
  magenta: "#CF78B4",
  bronze: "#C4A873",
  jade: "#8DB7A8",
  plum: "#A79AB0",
  wine: "#D38B8B",
  navy: "#202737",
  line: "rgba(255, 249, 238, 0.13)",
  glass: "rgba(41, 49, 66, 0.9)"
};

export const vanGoghColors = {
  ink: "#091628",
  panel: "#102a46",
  panelSoft: "#173a5f",
  ivory: "#fff3c9",
  muted: "#b8c7d9",
  gold: "#f2c85b",
  electric: "#4f8cff",
  magenta: "#c957a7",
  bronze: "#c38b32",
  jade: "#78a995",
  plum: "#284c7d",
  wine: "#7b3f52",
  navy: "#0b1f3a",
  line: "rgba(255, 220, 118, 0.22)",
  glass: "rgba(11, 31, 58, 0.9)"
};

export const monetColors = {
  ink: "#16373A",
  panel: "#21484A",
  panelSoft: "#2E5B5C",
  ivory: "#F7F3E8",
  muted: "#C4D9D2",
  gold: "#E6CB82",
  electric: "#70A9DD",
  magenta: "#D58BB5",
  bronze: "#C7A58E",
  jade: "#8FC7B4",
  plum: "#B9A3C8",
  wine: "#D49CB3",
  navy: "#102B31",
  line: "rgba(225, 244, 237, 0.14)",
  glass: "rgba(20, 52, 56, 0.9)"
};

export const daliColors = {
  ink: "#070A12",
  panel: "#141225",
  panelSoft: "#1A1730",
  ivory: "#F8FAFC",
  muted: "#A8A0B8",
  gold: "#F6C453",
  electric: "#527EF2",
  magenta: "#D83CA6",
  bronze: "#7C6F92",
  jade: "#34D399",
  plum: "#8B5CF6",
  wine: "#FB7185",
  navy: "#0B1020",
  line: "rgba(255, 255, 255, 0.08)",
  glass: "rgba(10, 8, 26, 0.84)"
};

export const picassoColors = {
  ink: "#202A42",
  panel: "#2C3752",
  panelSoft: "#3B4865",
  ivory: "#FFF3D8",
  muted: "#CFD4DF",
  gold: "#F0BC54",
  electric: "#6388E8",
  magenta: "#D85F9D",
  bronze: "#D77A5A",
  jade: "#6AAE9D",
  plum: "#7183C9",
  wine: "#D96550",
  navy: "#151D31",
  line: "rgba(255, 243, 216, 0.14)",
  glass: "rgba(28, 37, 59, 0.9)"
};

export const colors = darkColors;

export const appThemes = ["dark", "light", "vangogh", "monet", "dali", "picasso"] as const;

export type AppTheme = typeof appThemes[number];

export function getThemeColors(theme: AppTheme) {
  if (theme === "light") return lightColors;
  if (theme === "vangogh") return vanGoghColors;
  if (theme === "monet") return monetColors;
  if (theme === "dali") return daliColors;
  if (theme === "picasso") return picassoColors;
  return darkColors;
}

export function isBrightTheme(_theme: AppTheme) {
  return false;
}

export const spacing = {
  page: 20,
  radius: 8
};

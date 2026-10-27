export interface PracticalColor {
  name: string;
  hex: string;
}

export const CLOTHING_COLORS: PracticalColor[] = [
  // Neutrals & Monochromes
  { name: "Black", hex: "#111111" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Cream", hex: "#F5F2EB" },
  { name: "Sand", hex: "#C8B89E" },
  { name: "Beige", hex: "#D9CEBD" },
  { name: "Heather Grey", hex: "#A8A8A8" },
  { name: "Slate", hex: "#64748B" },
  { name: "Charcoal", hex: "#333333" },

  // Warm & Earth
  { name: "Brown", hex: "#5C4033" },
  { name: "Rust", hex: "#B75334" },
  { name: "Mustard", hex: "#D4A338" },
  { name: "Yellow", hex: "#E6C641" },

  // Greens
  { name: "Olive", hex: "#2D3A2F" },
  { name: "Forest Green", hex: "#1E3F20" },
  { name: "Sage Green", hex: "#8A9A86" },

  // Blues
  { name: "Sky Blue", hex: "#7AAECE" },
  { name: "Denim Blue", hex: "#4A6B82" },
  { name: "Cobalt", hex: "#0047AB" },
  { name: "Navy", hex: "#1B263B" },

  // Reds & Berries
  { name: "Crimson", hex: "#990000" },
  { name: "Wine / Maroon", hex: "#581825" },

  // Accents
  { name: "Pastel Pink", hex: "#E8B4B8" },
  { name: "Lavender", hex: "#9D8BB2" },
];

export const ALLOWED_COLORS = CLOTHING_COLORS.map((c) => c.name);

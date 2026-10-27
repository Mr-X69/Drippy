/**
 * Neutral Garment Placeholder Utility
 * Generates an intentional, non-photographic SVG representation for items lacking an uploaded photo.
 * Guarantees zero portraits, zero unrelated products, and zero external network requests.
 */

export function getNeutralPlaceholder(
  category = "garment",
  colorHex = "#2D3A2F"
): string {
  const safeCat = category.replace(/[^a-zA-Z0-9 -]/g, "");
  const safeColor = /^#[0-9A-Fa-f]{3,8}$/.test(colorHex) ? colorHex : "#2D3A2F";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400">
  <rect width="300" height="400" fill="#F0EDE6" rx="16"/>
  <circle cx="150" cy="175" r="42" fill="#EAE7E1" />
  <path d="M150 142 C143 142 138 147 138 154 C138 161 145 163 150 168 L110 196 C105 199 107 206 114 206 L186 206 C193 206 195 199 190 196 Z" fill="${safeColor}" opacity="0.85"/>
  <text x="150" y="248" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#1A1A1A" text-anchor="middle" letter-spacing="1.5" text-transform="uppercase">${safeCat}</text>
  <text x="150" y="268" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="500" fill="#8C887B" text-anchor="middle">No photo</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Validates whether an image URL is a genuine user photo or a known placeholder
 */
export function isPlaceholderImage(url?: string | null): boolean {
  if (!url || typeof url !== "string" || !url.trim()) return false;
  return url.startsWith("data:image/svg+xml") && url.includes("No%20photo");
}

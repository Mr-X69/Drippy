# Drippy — Design System & Master Specification

> **Aesthetic Archetype**: Warm Minimalist Editorial
> **Inspiration**: High-fashion lookbooks (Lemaire, The Row, COS, Studio Nicholson, SSENSE), tactile Japanese paper goods, and calm Scandinavian interior design.

---

## 1. Visual Philosophy & Core Pillars

1. **Tactile Warmth Over Sterile White**
   - Pure digital `#FFFFFF` feels clinical. Drippy uses `#F9F8F6` (Alabaster Linen) as the primary canvas to evoke natural fabrics, warm gallery walls, and archival cotton paper.
2. **Editorial High-Contrast Typography**
   - High readability with deliberate contrast. Rich charcoal (`#1A1A1A`) replaces harsh `#000000`.
   - Subtle all-caps micro-labels with expansive tracking (`tracking-[0.2em]`) provide a refined editorial magazine feel.
3. **Calm, Deliberate Earth Accents**
   - Deep Forest (`#2D3A2F`) serves as the primary signature accent for active states, key CTAs, and selected tabs.
4. **Editorial Ratio Discipline**
   - Every garment card and outfit photo strictly follows the **3:4 aspect ratio** (`aspect-[3/4]`), aligning with standard fashion photography and lookbook proportions.
5. **Mobile-First Luxury**
   - Centered `max-w-md` phone frame on desktop with warm stone surrounding backdrop (`#EAE8E3`), ensuring an intimate, handheld personal styling experience.

---

## 2. Color Tokens

| Token Name | Hex Code | Tailwind / CSS Variable | Purpose |
| :--- | :--- | :--- | :--- |
| **Warm Canvas (Background)** | `#F9F8F6` | `--color-warm-bg` / `bg-[#F9F8F6]` | Main screen background, sheets, bottom navigation base |
| **Pitch Charcoal (Foreground)** | `#1A1A1A` | `--color-charcoal` / `text-[#1A1A1A]` | Primary typography, active icons, high-emphasis headings |
| **Deep Forest (Accent)** | `#2D3A2F` | `--color-forest` / `bg-[#2D3A2F]` | Primary brand accent, active navigation pill, primary CTA |
| **Pure Surface (Card)** | `#FFFFFF` | `--color-warm-card` / `bg-white` | Garment card canvas, modals, popovers |
| **Stone Border** | `#EAE7E1` | `--color-warm-border` / `border-[#EAE7E1]` | Hairline borders, dividers, subtle outlines |
| **Warm Sand (Muted)** | `#EFECE6` | `--color-warm-sand` / `bg-[#EFECE6]` | Inactive filter pill backgrounds, search bars, tags |
| **Stone Slate (Muted Text)** | `#8C887B` | `--color-warm-muted` / `text-[#8C887B]` | Inactive icons, timestamps, category sub-labels |
| **Desktop Backdrop** | `#EAE8E3` | `bg-[#EAE8E3]` | Surrounding ambient canvas centering the mobile container |
| **Subtle Terracotta (Accent)** | `#C46D52` | `text-[#C46D52]` | Favorite heart active state, seasonal alert pills |

---

## 3. Typography & Hierarchy

- **Primary Font**: Geist Sans, Inter, or editorial system sans (`system-ui, -apple-system, BlinkMacSystemFont`).
- **Scale & Usage**:
  - **Brand Wordmark**: `text-xl font-medium tracking-[0.25em] uppercase text-[#1A1A1A]`
  - **Screen Titles**: `text-2xl font-semibold tracking-tight text-[#1A1A1A]`
  - **Editorial Subheaders**: `text-xs font-medium tracking-[0.18em] uppercase text-[#8C887B]`
  - **Garment Card Title**: `text-sm font-medium text-[#1A1A1A] line-clamp-1`
  - **Garment Brand / Subtitle**: `text-[11px] font-normal text-[#8C887B]`
  - **Pill / Filter Badges**: `text-xs font-medium tracking-wide`
  - **Navigation Labels**: `text-[10px] font-medium tracking-wider uppercase`

---

## 4. Layout & Grid Standards

### 4.1 Mobile-First Viewport
- **Container**: `max-w-md w-full min-h-screen bg-[#F9F8F6] relative shadow-2xl border-x border-[#EAE7E1] mx-auto`
- **Safe Area Padding**: `pb-24` ensures content is never obscured by the persistent `BottomNav`.

### 4.2 Editorial Garment Grid
- **Columns**: 2 columns (`grid grid-cols-2 gap-3.5 px-4 pt-2`)
- **Proportions**: Strict 3:4 ratio (`aspect-[3/4]`) for the photo container.
- **Card Styling**:
  - Image wrapped in `relative overflow-hidden rounded-2xl bg-[#EFECE6]`
  - Subtle 1px inner hairline border: `border border-[#EAE7E1]`
  - Quick action favorite button: floating glass circle `top-2.5 right-2.5`
  - Category micro-badge: floating pill `top-2.5 left-2.5 bg-[#F9F8F6]/85 backdrop-blur-sm`

---

## 5. Navigation & Components

### 5.1 Persistent Bottom Navigation (`BottomNav.tsx`)
- **Container**: `fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50`
- **Material**: `bg-[#F9F8F6]/92 backdrop-blur-md border-t border-[#EAE7E1]`
- **Tabs (4 core tabs)**:
  1. **Closet** (`Shirt` icon) — Inventory & garment curation
  2. **Style** (`Sparkles` icon) — AI stylist & outfit combination canvas
  3. **Planner** (`Calendar` icon) — Daily wear scheduler & calendar
  4. **Settings** (`SlidersHorizontal` icon) — Preferences, backup & export
- **Active State**: Deep Forest `#2D3A2F` or `#1A1A1A` with subtle dot indicator.
- **Inactive State**: `#8C887B` with smooth transition on tap/hover.

### 5.2 Interactive Filter Carousel
- Horizontal scroll with hidden scrollbars (`flex gap-2 overflow-x-auto no-scrollbar py-2`)
- Active chip: `bg-[#2D3A2F] text-[#F9F8F6]`
- Inactive chip: `bg-[#EFECE6] text-[#1A1A1A] hover:bg-[#EAE7E1]`

---

## 6. Offline-First Database Schema (Dexie.js)

### `wardrobe_items`
- `id`: Auto-increment integer (`++id`)
- `name`: Garment title (e.g. "Oversized Cashmere Knit")
- `category`: `tops` | `bottoms` | `outerwear` | `shoes` | `accessories` | `one-piece`
- `subCategory`: Optional string (e.g. "Knitwear", "Pleated Trousers")
- `color`: Primary color tone
- `brand`: Brand or source label
- `imageUrl`: Image URL or base64 blob
- `tags`: Array of string keywords
- `season`: Array of season tags (`['spring', 'fall', 'winter']`)
- `favorite`: Boolean toggle
- `createdAt`: Unix timestamp

### `outfits`
- `id`: Auto-increment integer (`++id`)
- `name`: Look title (e.g. "Minimal Autumn Commute")
- `description`: Notes or styling advice
- `itemIds`: Array of integer IDs referencing `wardrobe_items`
- `tags`: Occasion or mood tags
- `season`: Applicable seasons
- `occasion`: `work` | `casual` | `formal` | `weekend`
- `favorite`: Boolean toggle
- `createdAt`: Unix timestamp
- `lastWorn`: Optional Unix timestamp

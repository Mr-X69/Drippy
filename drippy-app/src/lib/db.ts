import Dexie, { type Table } from "dexie";
import { getNeutralPlaceholder } from "./placeholders";

export type GarmentCategory =
  | "tops"
  | "bottoms"
  | "outerwear"
  | "shoes"
  | "accessories"
  | "one-piece";

export type LaundryStatus = "clean" | "in_wash";

export interface WardrobeItem {
  id?: number;
  name: string;
  category: GarmentCategory | string;
  subCategory?: string;
  color: string;
  brand?: string;
  imageUrl: string;
  tags: string[];
  season: string[];
  occasions?: string[];
  laundryStatus?: LaundryStatus;
  favorite: boolean;
  createdAt: number;
  updatedAt?: number;
  isSample?: boolean;
}

export interface Outfit {
  id?: number;
  name: string;
  description?: string;
  itemIds: number[];
  tags: string[];
  season: string[];
  occasion?: "casual" | "formal" | "work" | "streetwear" | "evening" | string;
  favorite: boolean;
  createdAt: number;
  lastWorn?: number;
}

export type TrackType = "campus" | "gym" | "primary" | "secondary" | string;
export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface PlanSlot {
  id?: number;
  day: DayOfWeek;
  track: TrackType;
  itemIds: number[];
  topId?: number;
  bottomId?: number;
  footwearId?: number;
  onePieceId?: number;
  outerwearId?: number;
  accessoryId?: number;
  occasion?: string;
  isRestDay?: boolean;
  harmonyScore?: number;
  reasoning?: string;
  updatedAt: number;
}

export class DrippyDatabase extends Dexie {
  wardrobe_items!: Table<WardrobeItem, number>;
  outfits!: Table<Outfit, number>;
  planned_slots!: Table<PlanSlot, number>;

  constructor() {
    super("DrippyDB");
    this.version(1).stores({
      wardrobe_items: "++id, name, category, color, brand, favorite, createdAt",
      outfits: "++id, name, occasion, favorite, createdAt, lastWorn",
    });
    this.version(2).stores({
      planned_slots: "++id, day, track, [day+track], updatedAt",
    });
  }
}

export const db = new DrippyDatabase();

function isStorageAvailable(): boolean {
  return typeof window !== "undefined" || typeof indexedDB !== "undefined";
}

// Curated warm minimalist editorial seed garments
export const INITIAL_GARMENTS: Omit<WardrobeItem, "id">[] = [
  {
    name: "Alabaster Cashmere Mockneck",
    category: "tops",
    subCategory: "Knitwear",
    color: "#EFECE6",
    brand: "Lemaire",
    imageUrl:
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=800&q=80",
    tags: ["warm minimalist", "cashmere", "winter luxury", "relaxed"],
    season: ["fall", "winter", "spring"],
    favorite: true,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
  },
  {
    name: "Pleated Slate Wool Trousers",
    category: "bottoms",
    subCategory: "Tailoring",
    color: "#2D3A2F",
    brand: "Studio Nicholson",
    imageUrl:
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80",
    tags: ["wide-leg", "tailored", "forest tone", "minimal"],
    season: ["fall", "winter", "spring"],
    favorite: false,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
  },
  {
    name: "Double-Breasted Wool Overcoat",
    category: "outerwear",
    subCategory: "Coats",
    color: "#1A1A1A",
    brand: "The Row",
    imageUrl:
      "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=800&q=80",
    tags: ["editorial", "structured", "pitch charcoal", "statement"],
    season: ["fall", "winter"],
    favorite: true,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
  {
    name: "Raw Linen Camp Collar Shirt",
    category: "tops",
    subCategory: "Shirts",
    color: "#F9F8F6",
    brand: "COS Atelier",
    imageUrl:
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80",
    tags: ["breathable", "tactile linen", "summer staple", "relaxed"],
    season: ["spring", "summer"],
    favorite: false,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
  },
  {
    name: "Brushed Calfskin Derby Shoes",
    category: "shoes",
    subCategory: "Footwear",
    color: "#1A1A1A",
    brand: "Marsèll",
    imageUrl:
      "https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=800&q=80",
    tags: ["minimal", "leather", "timeless", "handcrafted"],
    season: ["all-season"],
    favorite: true,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    name: "Japanese Selvedge Ecru Denim",
    category: "bottoms",
    subCategory: "Denim",
    color: "#EFECE6",
    brand: "OrSlow",
    imageUrl:
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80",
    tags: ["ecru", "selvedge", "daily rotation", "straight fit"],
    season: ["spring", "summer", "fall", "winter"],
    favorite: false,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    name: "Heavy Gauge Forest Trench",
    category: "outerwear",
    subCategory: "Jackets",
    color: "#2D3A2F",
    brand: "Margaret Howell",
    imageUrl:
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80",
    tags: ["weatherproof", "deep forest", "heritage", "outerwear"],
    season: ["spring", "fall"],
    favorite: false,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 1,
  },
  {
    name: "Structured Minimal Tote",
    category: "accessories",
    subCategory: "Bags",
    color: "#1A1A1A",
    brand: "Jil Sander",
    imageUrl:
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80",
    tags: ["leather", "monochrome", "architectural", "essential"],
    season: ["all-season"],
    favorite: true,
    isSample: true,
    createdAt: Date.now(),
  },
  {
    name: "AeroTech Seamless Training Tee",
    category: "tops",
    subCategory: "Athletic Tee",
    color: "#333333",
    brand: "Gymshark",
    imageUrl:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
    tags: ["Gym", "Activewear", "training", "breathable", "performance"],
    season: ["all-season"],
    favorite: true,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
  },
  {
    name: "Heavyweight Cotton Pump Cover",
    category: "tops",
    subCategory: "Graphic Tee",
    color: "#111111",
    brand: "Drippy Sport",
    imageUrl:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80",
    tags: ["Gym", "Activewear", "pump cover", "oversized", "cotton"],
    season: ["all-season"],
    favorite: false,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 11,
  },
  {
    name: "Pro Linear 5\" Linerless Training Shorts",
    category: "bottoms",
    subCategory: "Training Shorts",
    color: "#111111",
    brand: "Ten Thousand",
    imageUrl:
      "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=800&q=80",
    tags: ["Gym", "Activewear", "stretch", "training", "quick-dry"],
    season: ["all-season"],
    favorite: true,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 10,
  },
  {
    name: "Tapered Tech Fleece Joggers",
    category: "bottoms",
    subCategory: "Sweatpants",
    color: "#A8A8A8",
    brand: "Nike Training",
    imageUrl:
      "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?auto=format&fit=crop&w=800&q=80",
    tags: ["Gym", "Activewear", "warmup", "comfort", "fleece"],
    season: ["fall", "winter", "spring"],
    favorite: false,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 9,
  },
  {
    name: "Metcon Free Cross-Training Shoes",
    category: "shoes",
    subCategory: "Training Shoes",
    color: "#111111",
    brand: "Nike",
    imageUrl:
      "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=800&q=80",
    tags: ["Gym", "Activewear", "lifting", "training", "footwear"],
    season: ["all-season"],
    favorite: true,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
  },
  {
    name: "Clean White Leather Low-Top Sneakers",
    category: "shoes",
    subCategory: "Sneakers",
    color: "#FFFFFF",
    brand: "Common Projects",
    imageUrl:
      "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?auto=format&fit=crop&w=800&q=80",
    tags: ["campus", "minimal", "essential", "daily", "leather"],
    season: ["all-season"],
    favorite: true,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 7,
  },
  {
    name: "Cloudswift Lightweight Road Runners",
    category: "shoes",
    subCategory: "Running Shoes",
    color: "#FFFFFF",
    brand: "On Running",
    imageUrl:
      "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80",
    tags: ["Gym", "Activewear", "cardio", "lightweight", "running"],
    season: ["all-season"],
    favorite: false,
    isSample: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
  },
];

// Safe read-only helper: queries existing items without modifying or auto-populating database
// Automatic demo injection is disabled to protect fresh user wardrobes from uninvited records.
export async function seedInitialWardrobeIfEmpty(): Promise<WardrobeItem[]> {
  if (!isStorageAvailable()) return [];
  try {
    return await db.wardrobe_items.toArray();
  } catch (error) {
    console.error("Failed to query initial wardrobe:", error);
    return [];
  }
}

// Explicit manual action: only called when user deliberately requests sample data
export async function loadSampleWardrobe(): Promise<WardrobeItem[]> {
  if (!isStorageAvailable()) return [];
  try {
    const samplesToInsert = INITIAL_GARMENTS.map((g) => ({
      ...g,
      isSample: true,
    }));
    await db.wardrobe_items.bulkAdd(samplesToInsert);
    return await db.wardrobe_items.toArray();
  } catch (error) {
    console.error("Failed to load sample wardrobe:", error);
    return [];
  }
}

// Known legacy sample photo identifiers from previous seed definitions
export const KNOWN_LEGACY_SAMPLE_PHOTO_IDS: readonly string[] = [
  "photo-1576566588028-4147f3842f27", // Alabaster Cashmere Mockneck
  "photo-1624378439575-d8705ad7ae80", // Pleated Slate Wool Trousers
  "photo-1544923246-77307dd654cb", // Double-Breasted Wool Overcoat (portrait woman)
  "photo-1596755094514-f87e34085b2c", // Raw Linen Camp Collar Shirt
  "photo-1614252369475-531eba835eb1", // Brushed Calfskin Derby Shoes
  "photo-1541099649105-f69ad21f3246", // Japanese Selvedge Ecru Denim
  "photo-1539571696357-5a69c17a67c6", // Heavy Gauge Forest Trench (portrait man)
  "photo-1548036328-c9fa89d128fa", // Structured Minimal Tote
  "photo-1521572267360-ee0c2909d518", // AeroTech Seamless Training Tee
  "photo-1503342217505-b0a15ec3261c", // Heavyweight Cotton Pump Cover
  "photo-1591195853828-11db59a44f6b", // Pro Linear 5" Linerless Training Shorts
  "photo-1552902865-b72c031ac5ea", // Tapered Tech Fleece Joggers
  "photo-1606107557195-0e29a4b5b4aa", // Metcon Free Cross-Training Shoes
  "photo-1584735935682-2f2b69dff9d2", // Cloudswift Lightweight Road Runners (mislabeled dumbbells)
  "photo-1539533018447-63fcce2678e3", // Phase 1 isolated coat
  "photo-1591047139829-d91aecb6caea", // Phase 1 isolated trench jacket
];

// Helper to reliably identify sample records without destroying user data.
// A record is ONLY confirmed as a sample if it matches known seed photo IDs or isSample flag.
// Never classifies by garment name alone.
export function isSampleGarment(item: WardrobeItem): boolean {
  if (item.isSample === true) return true;
  if (!item.imageUrl || typeof item.imageUrl !== "string") return false;
  // Genuine user uploads are base64 payloads or non-sample assets
  if (item.imageUrl.startsWith("data:image/jpeg;base64") || item.imageUrl.startsWith("data:image/png;base64")) {
    return false;
  }
  return KNOWN_LEGACY_SAMPLE_PHOTO_IDS.some((id) => item.imageUrl.includes(id));
}

export interface WardrobeAuditReport {
  total: number;
  genuine: WardrobeItem[];
  legacySamples: WardrobeItem[];
  duplicateSamples: WardrobeItem[];
  mislabeledImageSamples: WardrobeItem[];
}

/**
 * Inspects all records in Dexie and categorizes them safely
 */
export async function auditWardrobeRecords(): Promise<WardrobeAuditReport> {
  if (!isStorageAvailable()) {
    return { total: 0, genuine: [], legacySamples: [], duplicateSamples: [], mislabeledImageSamples: [] };
  }
  const all = await db.wardrobe_items.toArray();
  const genuine: WardrobeItem[] = [];
  const legacySamples: WardrobeItem[] = [];
  const duplicateSamples: WardrobeItem[] = [];
  const mislabeledImageSamples: WardrobeItem[] = [];

  const seenUrls = new Set<string>();

  for (const item of all) {
    if (!isSampleGarment(item)) {
      genuine.push(item);
      continue;
    }

    const isMislabeled =
      item.imageUrl.includes("photo-1544923246-77307dd654cb") || // woman face
      item.imageUrl.includes("photo-1539571696357-5a69c17a67c6") || // man face
      item.imageUrl.includes("photo-1584735935682-2f2b69dff9d2");   // dumbbells

    if (isMislabeled) {
      mislabeledImageSamples.push(item);
    }

    if (seenUrls.has(item.imageUrl)) {
      duplicateSamples.push(item);
    } else {
      seenUrls.add(item.imageUrl);
      legacySamples.push(item);
    }
  }

  return {
    total: all.length,
    genuine,
    legacySamples,
    duplicateSamples,
    mislabeledImageSamples,
  };
}

/**
 * Safely removes only confirmed duplicate sample records, keeping the primary sample and all genuine user items.
 */
export async function pruneDuplicateSamples(): Promise<{ removedCount: number; remainingCount: number }> {
  if (!isStorageAvailable()) return { removedCount: 0, remainingCount: 0 };
  const audit = await auditWardrobeRecords();
  const idsToDelete = audit.duplicateSamples
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number");

  if (idsToDelete.length > 0) {
    await db.wardrobe_items.bulkDelete(idsToDelete);
  }
  const remainingCount = await db.wardrobe_items.count();
  return { removedCount: idsToDelete.length, remainingCount };
}

/**
 * Sanitizes sample records that have mislabeled or human portrait images
 * by setting their imageUrl to an intentional neutral placeholder.
 */
export async function sanitizeMislabeledSampleImages(): Promise<number> {
  if (!isStorageAvailable()) return 0;
  const audit = await auditWardrobeRecords();
  let updatedCount = 0;
  for (const item of audit.mislabeledImageSamples) {
    if (item.id) {
      const neutralUri = getNeutralPlaceholder(item.category, item.color);
      await db.wardrobe_items.update(item.id, {
        imageUrl: neutralUri,
        updatedAt: Date.now(),
      });
      updatedCount++;
    }
  }
  return updatedCount;
}

/**
 * Purges ALL confirmed legacy sample records, strictly preserving all genuine user garments.
 */
export async function purgeAllLegacySamples(): Promise<{ removedCount: number; genuinePreservedCount: number }> {
  if (!isStorageAvailable()) return { removedCount: 0, genuinePreservedCount: 0 };
  const audit = await auditWardrobeRecords();
  const idsToDelete = [...audit.legacySamples, ...audit.duplicateSamples]
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number");

  if (idsToDelete.length > 0) {
    await db.wardrobe_items.bulkDelete(idsToDelete);
  }
  const remainingCount = await db.wardrobe_items.count();
  return { removedCount: idsToDelete.length, genuinePreservedCount: remainingCount };
}

/**
 * Completely resets wardrobe items, outfits, and planner assignments to a pristine clean state,
 * preventing dangling ID references.
 */
export async function clearWardrobeAndPlannerData(): Promise<void> {
  if (!isStorageAvailable()) return;
  try {
    await db.wardrobe_items.clear();
    await db.outfits.clear();
    await db.planned_slots.clear();
  } catch (err) {
    console.error("Failed to clear wardrobe and planner data:", err);
  }
}

// Data access helpers
export async function getAllWardrobeItems(onlyClean = false): Promise<WardrobeItem[]> {
  if (!isStorageAvailable()) return [];
  try {
    const items = await db.wardrobe_items.reverse().sortBy("createdAt");
    if (onlyClean) {
      return items.filter((item) => item.laundryStatus !== "in_wash");
    }
    return items;
  } catch (err) {
    console.error("Error fetching wardrobe items:", err);
    return [];
  }
}

export async function toggleFavoriteItem(id: number): Promise<boolean> {
  if (!isStorageAvailable()) return false;
  const item = await db.wardrobe_items.get(id);
  if (!item) return false;
  const nextFav = !item.favorite;
  await db.wardrobe_items.update(id, { favorite: nextFav, updatedAt: Date.now() });
  return nextFav;
}

export async function toggleLaundryStatus(id: number): Promise<LaundryStatus> {
  if (!isStorageAvailable()) return "clean";
  const item = await db.wardrobe_items.get(id);
  if (!item) return "clean";
  const nextStatus: LaundryStatus =
    item.laundryStatus === "in_wash" ? "clean" : "in_wash";
  await db.wardrobe_items.update(id, {
    laundryStatus: nextStatus,
    updatedAt: Date.now(),
  });
  return nextStatus;
}

export async function addWardrobeItem(
  item: Omit<WardrobeItem, "id">
): Promise<number> {
  return await db.wardrobe_items.add(item);
}

/**
 * Safely deletes a single wardrobe item from Dexie and cleans up any references
 * in saved outfits and weekly planner slots, preventing dangling broken IDs
 * without clearing or affecting any other wardrobe records.
 */
export async function safeDeleteWardrobeItem(id: number): Promise<void> {
  if (!isStorageAvailable()) return;

  // 1. Delete item from wardrobe_items
  await db.wardrobe_items.delete(id);

  // 2. Cascade cleanup in planned_slots: remove references
  const allSlots = await db.planned_slots.toArray();
  for (const slot of allSlots) {
    if (!slot.id) continue;
    let modified = false;
    let topId = slot.topId;
    let bottomId = slot.bottomId;
    let footwearId = slot.footwearId;
    let onePieceId = slot.onePieceId;
    let outerwearId = slot.outerwearId;
    let accessoryId = slot.accessoryId;

    if (topId === id) {
      topId = undefined;
      modified = true;
    }
    if (bottomId === id) {
      bottomId = undefined;
      modified = true;
    }
    if (footwearId === id) {
      footwearId = undefined;
      modified = true;
    }
    if (onePieceId === id) {
      onePieceId = undefined;
      modified = true;
    }
    if (outerwearId === id) {
      outerwearId = undefined;
      modified = true;
    }
    if (accessoryId === id) {
      accessoryId = undefined;
      modified = true;
    }

    const nextItemIds = (slot.itemIds || []).filter((itemId) => itemId !== id);
    if (nextItemIds.length !== (slot.itemIds || []).length) {
      modified = true;
    }

    if (modified) {
      await db.planned_slots.update(slot.id, {
        topId,
        bottomId,
        footwearId,
        onePieceId,
        outerwearId,
        accessoryId,
        itemIds: nextItemIds,
        updatedAt: Date.now(),
      });
    }
  }

  // 3. Cascade cleanup in outfits: remove references
  const allOutfits = await db.outfits.toArray();
  for (const outfit of allOutfits) {
    if (!outfit.id) continue;
    if (outfit.itemIds && outfit.itemIds.includes(id)) {
      const nextIds = outfit.itemIds.filter((itemId) => itemId !== id);
      await db.outfits.update(outfit.id, {
        itemIds: nextIds,
      });
    }
  }
}

export async function deleteWardrobeItem(id: number): Promise<void> {
  await safeDeleteWardrobeItem(id);
}

// Helpers for Weekly Planner slots
export async function getAllPlannedSlots(): Promise<PlanSlot[]> {
  if (!isStorageAvailable()) return [];
  try {
    return await db.planned_slots.toArray();
  } catch (err) {
    console.error("Error fetching planned slots:", err);
    return [];
  }
}

export async function setPlanSlot(
  day: DayOfWeek,
  track: TrackType,
  itemIds: number[]
): Promise<void> {
  if (!isStorageAvailable()) return;
  try {
    const existing = await db.planned_slots
      .where({ day, track })
      .first();

    if (existing && existing.id) {
      await db.planned_slots.update(existing.id, {
        itemIds,
        topId: itemIds[0],
        bottomId: itemIds[1],
        footwearId: itemIds[2],
        updatedAt: Date.now(),
      });
    } else {
      await db.planned_slots.add({
        day,
        track,
        itemIds,
        topId: itemIds[0],
        bottomId: itemIds[1],
        footwearId: itemIds[2],
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.error("Error setting planned slot:", err);
  }
}

export type PlannerRole = "tops" | "bottoms" | "shoes" | "one_piece" | "outerwear";

export async function setPlanSlotPiece(
  day: DayOfWeek,
  track: TrackType,
  slotRole: PlannerRole,
  itemId: number
): Promise<void> {
  if (!isStorageAvailable()) return;
  try {
    const existing = await db.planned_slots.where({ day, track }).first();
    let topId = existing?.topId;
    let bottomId = existing?.bottomId;
    let footwearId = existing?.footwearId;
    let onePieceId = existing?.onePieceId;
    let outerwearId = existing?.outerwearId;

    if (slotRole === "one_piece") {
      onePieceId = itemId;
      topId = undefined;
      bottomId = undefined;
    } else if (slotRole === "tops") {
      topId = itemId;
      onePieceId = undefined;
    } else if (slotRole === "bottoms") {
      bottomId = itemId;
      onePieceId = undefined;
    } else if (slotRole === "shoes") {
      footwearId = itemId;
    } else if (slotRole === "outerwear") {
      outerwearId = itemId;
    }

    const itemIds = [topId, bottomId, footwearId, onePieceId, outerwearId].filter(
      (id): id is number => typeof id === "number"
    );

    if (existing && existing.id) {
      await db.planned_slots.update(existing.id, {
        topId,
        bottomId,
        footwearId,
        onePieceId,
        outerwearId,
        itemIds,
        updatedAt: Date.now(),
      });
    } else {
      await db.planned_slots.add({
        day,
        track,
        topId,
        bottomId,
        footwearId,
        onePieceId,
        outerwearId,
        itemIds,
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.error("Error setting plan slot piece:", err);
  }
}

export async function setDayOccasion(
  day: DayOfWeek,
  track: TrackType,
  occasion: string
): Promise<void> {
  if (!isStorageAvailable()) return;
  try {
    const existing = await db.planned_slots.where({ day, track }).first();
    const isRest = occasion === "rest";
    if (existing && existing.id) {
      await db.planned_slots.update(existing.id, {
        occasion,
        isRestDay: isRest,
        updatedAt: Date.now(),
      });
    } else {
      await db.planned_slots.add({
        day,
        track,
        occasion,
        isRestDay: isRest,
        itemIds: [],
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.error("Error setting day occasion:", err);
  }
}

export async function setFullPlanOutfit(
  day: DayOfWeek,
  track: TrackType,
  topId?: number,
  bottomId?: number,
  footwearId?: number,
  harmonyScore?: number,
  reasoning?: string,
  extra?: {
    onePieceId?: number;
    outerwearId?: number;
    accessoryId?: number;
    occasion?: string;
    isRestDay?: boolean;
  }
): Promise<void> {
  if (!isStorageAvailable()) return;
  try {
    const existing = await db.planned_slots.where({ day, track }).first();
    const itemIds = [topId, bottomId, footwearId, extra?.onePieceId, extra?.outerwearId, extra?.accessoryId].filter(
      (id): id is number => typeof id === "number"
    );

    if (existing && existing.id) {
      await db.planned_slots.update(existing.id, {
        topId,
        bottomId,
        footwearId,
        onePieceId: extra?.onePieceId ?? existing.onePieceId,
        outerwearId: extra?.outerwearId ?? existing.outerwearId,
        accessoryId: extra?.accessoryId ?? existing.accessoryId,
        occasion: extra?.occasion ?? existing.occasion,
        isRestDay: extra?.isRestDay ?? existing.isRestDay ?? false,
        itemIds,
        harmonyScore: harmonyScore ?? existing.harmonyScore,
        reasoning: reasoning ?? existing.reasoning,
        updatedAt: Date.now(),
      });
    } else {
      await db.planned_slots.add({
        day,
        track,
        topId,
        bottomId,
        footwearId,
        onePieceId: extra?.onePieceId,
        outerwearId: extra?.outerwearId,
        accessoryId: extra?.accessoryId,
        occasion: extra?.occasion,
        isRestDay: extra?.isRestDay ?? false,
        itemIds,
        harmonyScore,
        reasoning,
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.error("Error setting full plan outfit:", err);
  }
}

export async function setDayRestStatus(
  day: DayOfWeek,
  track: TrackType,
  isRest: boolean,
  occasion?: string
): Promise<void> {
  if (!isStorageAvailable()) return;
  try {
    const existing = await db.planned_slots.where({ day, track }).first();
    if (existing && existing.id) {
      await db.planned_slots.update(existing.id, {
        isRestDay: isRest,
        occasion: occasion ?? existing.occasion,
        updatedAt: Date.now(),
      });
    } else {
      await db.planned_slots.add({
        day,
        track,
        itemIds: [],
        isRestDay: isRest,
        occasion: occasion ?? "rest",
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.error("Error setting day rest status:", err);
  }
}

export async function resolvePlanSlotPieces(slot: PlanSlot): Promise<{
  top?: WardrobeItem;
  bottom?: WardrobeItem;
  footwear?: WardrobeItem;
  onePiece?: WardrobeItem;
  outerwear?: WardrobeItem;
  missingItemIds: number[];
}> {
  if (!isStorageAvailable()) {
    return { missingItemIds: [] };
  }
  const allIds = [slot.topId, slot.bottomId, slot.footwearId, slot.onePieceId, slot.outerwearId].filter(
    (id): id is number => typeof id === "number"
  );

  if (allIds.length === 0) {
    return { missingItemIds: [] };
  }

  const foundItems = await db.wardrobe_items.where("id").anyOf(allIds).toArray();
  const itemsMap = new Map<number, WardrobeItem>();
  foundItems.forEach((item) => {
    if (typeof item.id === "number") itemsMap.set(item.id, item);
  });

  const missingItemIds = allIds.filter((id) => !itemsMap.has(id));

  return {
    top: slot.topId ? itemsMap.get(slot.topId) : undefined,
    bottom: slot.bottomId ? itemsMap.get(slot.bottomId) : undefined,
    footwear: slot.footwearId ? itemsMap.get(slot.footwearId) : undefined,
    onePiece: slot.onePieceId ? itemsMap.get(slot.onePieceId) : undefined,
    outerwear: slot.outerwearId ? itemsMap.get(slot.outerwearId) : undefined,
    missingItemIds,
  };
}

export async function clearPlanSlot(day: DayOfWeek, track: TrackType): Promise<void> {
  if (!isStorageAvailable()) return;
  try {
    const existing = await db.planned_slots
      .where({ day, track })
      .first();
    if (existing && existing.id) {
      await db.planned_slots.delete(existing.id);
    }
  } catch (err) {
    console.error("Error clearing planned slot:", err);
  }
}

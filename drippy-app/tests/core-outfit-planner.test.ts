import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  db,
  setFullPlanOutfit,
  setPlanSlotPiece,
  setDayOccasion,
  resolvePlanSlotPieces,
  type WardrobeItem,
  type DayOfWeek,
} from "@/lib/db";
import {
  generateDeterministicOutfit,
  evaluateColorHarmony,
  evaluateFormalityMatch,
  evaluateWeatherSuitability,
  mapColorToFamily,
  normalizeCategoryToRole,
  validateOutfitAgainstInventory,
} from "@/lib/outfit-engine";
import { type WeatherData } from "@/lib/weather";

describe("Core Outfit Recommendation Engine & Custom Planner", () => {
  beforeEach(async () => {
    await db.wardrobe_items.clear();
    await db.planned_slots.clear();
    await db.outfits.clear();
  });

  // Sample items for deterministic testing
  const sampleNavyTee: WardrobeItem = {
    id: 101,
    name: "Classic Navy Crewneck",
    category: "tops",
    color: "#000080",
    tags: ["casual", "daily", "cotton"],
    season: ["all-season"],
    imageUrl: "https://example.com/navy.jpg",
    laundryStatus: "clean",
    favorite: false,
    createdAt: Date.now(),
  };

  const sampleBlackChinos: WardrobeItem = {
    id: 102,
    name: "Pleated Black Chinos",
    category: "bottoms",
    color: "#000000",
    tags: ["casual", "smart_casual", "trousers"],
    season: ["all-season"],
    imageUrl: "https://example.com/chinos.jpg",
    laundryStatus: "clean",
    favorite: true,
    createdAt: Date.now(),
  };

  const sampleWhiteSneakers: WardrobeItem = {
    id: 103,
    name: "Clean White Leather Lows",
    category: "shoes",
    color: "#FFFFFF",
    tags: ["casual", "minimal", "sneakers"],
    season: ["all-season"],
    imageUrl: "https://example.com/white-sneakers.jpg",
    laundryStatus: "clean",
    favorite: false,
    createdAt: Date.now(),
  };

  const sampleLaundryShirt: WardrobeItem = {
    id: 104,
    name: "Dirty Oxford Shirt",
    category: "tops",
    color: "#FFFFFF",
    tags: ["work", "formal"],
    season: ["all-season"],
    imageUrl: "https://example.com/shirt.jpg",
    laundryStatus: "in_wash",
    favorite: false,
    createdAt: Date.now(),
  };

  const sampleLinenDress: WardrobeItem = {
    id: 105,
    name: "Ecru Linen Midi Dress",
    category: "dresses",
    color: "#EFECE6",
    tags: ["casual", "dinner", "summer"],
    season: ["all-season"],
    imageUrl: "https://example.com/dress.jpg",
    laundryStatus: "clean",
    favorite: false,
    createdAt: Date.now(),
  };

  const sampleGymTop: WardrobeItem = {
    id: 106,
    name: "AeroTech Training Tee",
    category: "tops",
    color: "#1A1A1A",
    tags: ["Gym", "Activewear", "training"],
    subCategory: "Athletic Shirt",
    season: ["all-season"],
    imageUrl: "https://example.com/gym-top.jpg",
    laundryStatus: "clean",
    favorite: false,
    createdAt: Date.now(),
  };

  const sampleGymShorts: WardrobeItem = {
    id: 107,
    name: "Pro 5\" Training Shorts",
    category: "bottoms",
    color: "#1A1A1A",
    tags: ["Gym", "Activewear", "training"],
    subCategory: "Athletic Shorts",
    season: ["all-season"],
    imageUrl: "https://example.com/gym-shorts.jpg",
    laundryStatus: "clean",
    favorite: false,
    createdAt: Date.now(),
  };

  const sampleGymShoes: WardrobeItem = {
    id: 108,
    name: "Metcon Free Cross-Trainers",
    category: "shoes",
    color: "#000000",
    tags: ["Gym", "Activewear", "training"],
    subCategory: "Training Shoes",
    season: ["all-season"],
    imageUrl: "https://example.com/gym-shoes.jpg",
    laundryStatus: "clean",
    favorite: false,
    createdAt: Date.now(),
  };

  const sampleFormalBlazer: WardrobeItem = {
    id: 109,
    name: "Charcoal Wool Tuxedo Blazer",
    category: "outerwear",
    color: "#333333",
    tags: ["formal", "tuxedo", "black-tie"],
    subCategory: "Blazer",
    season: ["all-season"],
    imageUrl: "https://example.com/blazer.jpg",
    laundryStatus: "clean",
    favorite: false,
    createdAt: Date.now(),
  };

  describe("1. Compatibility Engine Rules & Categorization", () => {
    it("normalizes diverse garment categories and subcategories into standard roles", () => {
      expect(normalizeCategoryToRole("tops")).toBe("top");
      expect(normalizeCategoryToRole("T-Shirts")).toBe("top");
      expect(normalizeCategoryToRole("bottoms")).toBe("bottom");
      expect(normalizeCategoryToRole("pants")).toBe("bottom");
      expect(normalizeCategoryToRole("dresses")).toBe("one_piece");
      expect(normalizeCategoryToRole("jumpsuits")).toBe("one_piece");
      expect(normalizeCategoryToRole("shoes")).toBe("footwear");
      expect(normalizeCategoryToRole("sneakers")).toBe("footwear");
      expect(normalizeCategoryToRole("jackets")).toBe("outerwear");
      expect(normalizeCategoryToRole("bags")).toBe("accessory");
    });

    it("correctly maps garment colors to standard aesthetic color families", () => {
      expect(mapColorToFamily("#FFFFFF")).toBe("white");
      expect(mapColorToFamily("#000000")).toBe("black");
      expect(mapColorToFamily("#000080")).toBe("navy_blue");
      expect(mapColorToFamily("navy")).toBe("navy_blue");
      expect(mapColorToFamily("#808080")).toBe("grey");
      expect(mapColorToFamily("#F5F5DC")).toBe("earth_beige");
    });

    it("evaluates color harmony and penalizes jarring combinations", () => {
      // Classic harmonious palette: White, Black, Navy
      const harmonious = evaluateColorHarmony(["white", "black", "navy_blue"]);
      expect(harmonious.score).toBeGreaterThanOrEqual(28);
      expect(harmonious.reasoning).toContain("navy blue");

      // Too many saturated accent colors
      const clash = evaluateColorHarmony(["warm_accent", "cool_accent", "forest_green", "warm_accent"]);
      expect(clash.score).toBeLessThanOrEqual(20);
    });

    it("evaluates formality and strictly rejects athletic wear for formal events and formal wear for gym", () => {
      // Gym occasion with athletic wear
      const gymValid = evaluateFormalityMatch([sampleGymTop, sampleGymShorts, sampleGymShoes], "gym");
      expect(gymValid.isValid).toBe(true);

      // Gym occasion with formal blazer
      const gymInvalid = evaluateFormalityMatch([sampleGymTop, sampleFormalBlazer, sampleGymShoes], "gym");
      expect(gymInvalid.isValid).toBe(false);
      expect(gymInvalid.reasoning).toContain("Gym slot strictly requires activewear");

      // Formal occasion with gym shorts
      const formalInvalid = evaluateFormalityMatch([sampleGymShorts, sampleFormalBlazer, sampleWhiteSneakers], "formal");
      expect(formalInvalid.isValid).toBe(false);
      expect(formalInvalid.reasoning).toContain("Formality conflict");
    });
  });

  describe("2. Multi-Structure Recommendation Generation", () => {
    it("generates a standard 3-piece [Top, Bottom, Shoes] outfit when inventory supports it", () => {
      const inventory = [sampleNavyTee, sampleBlackChinos, sampleWhiteSneakers];
      const result = generateDeterministicOutfit({ inventory, occasion: "college" });

      expect(result.success).toBe(true);
      expect(result.outfit).toBeDefined();
      expect(result.outfit?.structure).toBe("standard");
      expect(result.outfit?.top?.id).toBe(101);
      expect(result.outfit?.bottom?.id).toBe(102);
      expect(result.outfit?.footwear?.id).toBe(103);
      expect(result.outfit?.harmonyScore).toBeGreaterThan(6.0);
      expect(result.outfit?.reasoning).toBeTruthy();
    });

    it("generates a 1-piece [Dress, Shoes] outfit when one-piece garments are available", () => {
      const inventory = [sampleLinenDress, sampleWhiteSneakers];
      const result = generateDeterministicOutfit({
        inventory,
        occasion: "casual",
        preferAlternativeStructures: true,
      });

      expect(result.success).toBe(true);
      expect(result.outfit).toBeDefined();
      expect(result.outfit?.structure).toBe("one_piece");
      expect(result.outfit?.onePiece?.id).toBe(105);
      expect(result.outfit?.footwear?.id).toBe(103);
      expect(result.outfit?.top).toBeUndefined();
      expect(result.outfit?.bottom).toBeUndefined();
    });

    it("prioritizes anchor item when an anchorItemId is specified", () => {
      const altTop: WardrobeItem = {
        id: 110,
        name: "Alternative Olive Tee",
        category: "tops",
        color: "#556B2F",
        tags: ["casual"],
        season: ["all-season"],
        imageUrl: "https://example.com/olive.jpg",
        laundryStatus: "clean",
        favorite: false,
        createdAt: Date.now(),
      };

      const inventory = [sampleNavyTee, altTop, sampleBlackChinos, sampleWhiteSneakers];
      const result = generateDeterministicOutfit({
        inventory,
        occasion: "casual",
        anchorItemId: 110,
      });

      expect(result.success).toBe(true);
      expect(result.outfit?.top?.id).toBe(110);
    });
  });

  describe("3. Clean Status & Laundry Filtering", () => {
    it("strictly excludes items marked as in_wash from recommendations", () => {
      // Only one clean top (navy tee) and one in_wash top (dirty shirt)
      const inventory = [sampleNavyTee, sampleLaundryShirt, sampleBlackChinos, sampleWhiteSneakers];
      const result = generateDeterministicOutfit({ inventory, occasion: "work" });

      expect(result.success).toBe(true);
      expect(result.outfit?.top?.id).toBe(101); // Only clean top selected
      expect(result.outfit?.top?.id).not.toBe(104);
    });

    it("fails with INSUFFICIENT_CLEAN_ITEMS if all tops or bottoms are in laundry", () => {
      const inventory = [sampleLaundryShirt, sampleBlackChinos, sampleWhiteSneakers];
      const result = generateDeterministicOutfit({ inventory, occasion: "casual" });

      expect(result.success).toBe(false);
      expect(result.reasonCode).toBe("MISSING_TOPS_OR_BOTTOMS");
      expect(result.error).toContain("Insufficient wardrobe pieces");
    });
  });

  describe("4. Weather Integration & Graceful Degradation", () => {
    it("applies hot weather adaptations when temperature is high", () => {
      const hotWeather: WeatherData = {
        temperature: 34,
        apparentTemperature: 36,
        isDay: true,
        precipitation: 0,
        weatherCode: 0,
        condition: "Clear",
        category: "clear",
        humidity: 45,
        windSpeed: 8,
        latitude: 18.52,
        longitude: 73.85,
        fetchedAt: Date.now(),
        summary: "34°C • Hot & Clear",
      };

      const evalResult = evaluateWeatherSuitability([sampleLinenDress, sampleWhiteSneakers], hotWeather);
      expect(evalResult.score).toBeGreaterThanOrEqual(16);
      expect(evalResult.reasoning).toContain("Lightweight & breathable");
    });

    it("applies rain protection awareness when precipitation is active", () => {
      const rainWeather: WeatherData = {
        temperature: 20,
        apparentTemperature: 19,
        isDay: true,
        precipitation: 5.2,
        weatherCode: 61,
        condition: "Rain",
        category: "rain",
        humidity: 90,
        windSpeed: 15,
        latitude: 18.52,
        longitude: 73.85,
        fetchedAt: Date.now(),
        summary: "20°C • Rain Showers",
      };

      const evalResult = evaluateWeatherSuitability([sampleNavyTee, sampleBlackChinos, sampleWhiteSneakers], rainWeather);
      expect(evalResult.reasoning).toContain("Rainy weather");
    });

    it("gracefully degrades to pure style-based curation when weather is strictly null", () => {
      const inventory = [sampleNavyTee, sampleBlackChinos, sampleWhiteSneakers];
      const result = generateDeterministicOutfit({ inventory, occasion: "casual", weather: null });

      expect(result.success).toBe(true);
      expect(result.outfit).toBeDefined();
      expect(result.outfit?.breakdown.weatherScore).toBe(15); // Neutral weather score
      expect(result.outfit?.reasoning).toContain("Timeless seasonal balance");
    });
  });

  describe("5. Insufficient Inventory & Never Fabricates IDs", () => {
    it("returns EMPTY_INVENTORY reason code when wardrobe is empty without inventing items", () => {
      const result = generateDeterministicOutfit({ inventory: [] });
      expect(result.success).toBe(false);
      expect(result.reasonCode).toBe("EMPTY_INVENTORY");
      expect(result.outfit).toBeUndefined();
    });

    it("returns PARTIAL_OUTFIT pairing top & bottom when clean shoes are missing", () => {
      const inventory = [sampleNavyTee, sampleBlackChinos];
      const result = generateDeterministicOutfit({ inventory });
      expect(result.success).toBe(true);
      expect(result.isPartial).toBe(true);
      expect(result.reasonCode).toBe("PARTIAL_OUTFIT");
      expect(result.missingCategory).toBe("footwear");
      expect(result.outfit?.structure).toBe("partial_top_bottom");
    });

    it("validates that all returned IDs actually exist in clean inventory", () => {
      const inventory = [sampleNavyTee, sampleBlackChinos, sampleWhiteSneakers];
      const result = generateDeterministicOutfit({ inventory });

      expect(result.success).toBe(true);
      const validation = validateOutfitAgainstInventory(result.outfit!, inventory);
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe("6. Customizable Planner Persistence & Single-Day Curation", () => {
    it("persists a full outfit for a single day in Dexie without overwriting other days", async () => {
      // Setup Monday and Tuesday
      await setFullPlanOutfit("Mon", "campus", 101, 102, 103, 8.8, "Monday fit", {
        occasion: "college",
      });
      await setFullPlanOutfit("Tue", "campus", 105, undefined, 103, 9.0, "Tuesday dress", {
        onePieceId: 105,
        occasion: "dinner",
      });

      // Update ONLY Monday to a new top
      await setPlanSlotPiece("Mon", "campus", "tops", 106);

      // Verify Monday updated
      const monSlot = await db.planned_slots.where({ day: "Mon", track: "campus" }).first();
      expect(monSlot?.topId).toBe(106);
      expect(monSlot?.bottomId).toBe(102);

      // Verify Tuesday remained completely untouched
      const tueSlot = await db.planned_slots.where({ day: "Tue", track: "campus" }).first();
      expect(tueSlot?.onePieceId).toBe(105);
      expect(tueSlot?.occasion).toBe("dinner");
      expect(tueSlot?.harmonyScore).toBe(9.0);
    });

    it("supports setting rest day status without destroying slot configuration", async () => {
      await setDayOccasion("Sun", "campus", "rest");

      const sunSlot = await db.planned_slots.where({ day: "Sun", track: "campus" }).first();
      expect(sunSlot?.isRestDay).toBe(true);
      expect(sunSlot?.occasion).toBe("rest");

      // Switch to active occasion
      await setDayOccasion("Sun", "campus", "casual");
      const updatedSlot = await db.planned_slots.where({ day: "Sun", track: "campus" }).first();
      expect(updatedSlot?.isRestDay).toBe(false);
      expect(updatedSlot?.occasion).toBe("casual");
    });

    it("resolves plan slot pieces and identifies deleted/missing garment IDs gracefully", async () => {
      // Insert item 101 and 103, but DO NOT insert item 999
      await db.wardrobe_items.add(sampleNavyTee);
      await db.wardrobe_items.add(sampleWhiteSneakers);

      const slotWithMissingBottom = {
        day: "Wed" as DayOfWeek,
        track: "campus" as const,
        topId: 101,
        bottomId: 999, // Missing / deleted garment
        footwearId: 103,
        itemIds: [101, 999, 103],
        updatedAt: Date.now(),
      };

      const resolved = await resolvePlanSlotPieces(slotWithMissingBottom);
      expect(resolved.top?.id).toBe(101);
      expect(resolved.footwear?.id).toBe(103);
      expect(resolved.bottom).toBeUndefined();
      expect(resolved.missingItemIds).toContain(999);
    });

    it("allows replacing an individual garment in a planned outfit without regenerating whole outfit", async () => {
      await db.wardrobe_items.bulkAdd([sampleNavyTee, sampleBlackChinos, sampleWhiteSneakers, sampleGymShoes]);

      await setFullPlanOutfit("Thu", "campus", 101, 102, 103, 8.5, "Initial fit");

      // Replace only footwear
      await setPlanSlotPiece("Thu", "campus", "shoes", 108);

      const slot = await db.planned_slots.where({ day: "Thu", track: "campus" }).first();
      expect(slot?.topId).toBe(101);
      expect(slot?.bottomId).toBe(102);
      expect(slot?.footwearId).toBe(108); // Updated to Metcon
    });
  });
});

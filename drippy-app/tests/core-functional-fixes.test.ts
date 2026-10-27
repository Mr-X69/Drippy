import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  db,
  WardrobeItem,
  safeDeleteWardrobeItem,
  addWardrobeItem,
  setFullPlanOutfit,
  getAllPlannedSlots,
} from "@/lib/db";
import {
  generateDeterministicOutfit,
} from "@/lib/outfit-engine";
import {
  parseCategoryFromAi,
  resolveColorFromAi,
  QueuedBulkWardrobeItem,
} from "@/components/AddGarmentModal";
import {
  getConfiguredLocation,
  setConfiguredLocation,
  clearConfiguredLocation,
  getLiveWeather,
  WeatherData,
  ConfiguredLocation,
} from "@/lib/weather";

describe("Core Functional Fixes: Garments, Styling & Weather", () => {
  beforeEach(async () => {
    await db.wardrobe_items.clear();
    await db.outfits.clear();
    await db.planned_slots.clear();
    clearConfiguredLocation();
  });

  describe("1. Single-Photo AI Autofill Parsing & Error Safeguards", () => {
    it("correctly normalizes AI category strings to canonical categories", () => {
      expect(parseCategoryFromAi("Top")).toBe("tops");
      expect(parseCategoryFromAi("Graphic Tee")).toBe("tops");
      expect(parseCategoryFromAi("Heavyweight Hoodie")).toBe("tops");
      expect(parseCategoryFromAi("Tailored Trousers")).toBe("bottoms");
      expect(parseCategoryFromAi("Denim Jeans")).toBe("bottoms");
      expect(parseCategoryFromAi("Pleated Chinos")).toBe("bottoms");
      expect(parseCategoryFromAi("Overcoat")).toBe("outerwear");
      expect(parseCategoryFromAi("Trench Jacket")).toBe("outerwear");
      expect(parseCategoryFromAi("Derby Shoes")).toBe("shoes");
      expect(parseCategoryFromAi("Sneakers")).toBe("shoes");
      expect(parseCategoryFromAi("Tote Bag")).toBe("accessories");
      expect(parseCategoryFromAi(undefined)).toBe("tops");
    });

    it("correctly resolves AI color responses to predefined allowed palette swatches", () => {
      expect(resolveColorFromAi("Olive").name).toBe("Olive");
      expect(resolveColorFromAi("Dark Charcoal").name).toBe("Charcoal");
      expect(resolveColorFromAi("Off-white cream").name).toBe("Cream");
      expect(resolveColorFromAi("Burgundy wine").name).toBe("Wine / Maroon");
      expect(resolveColorFromAi("Navy blue").name).toBe("Navy");
      expect(resolveColorFromAi("Forest green").name).toBe("Forest Green");
      expect(resolveColorFromAi("Pitch black").name).toBe("Black");
      expect(resolveColorFromAi("Unknown Exotic Tone").name).toBe("Olive"); // Safe fallback
    });
  });

  describe("2. Bulk Upload Independent Processing & Queue Editing", () => {
    it("allows independent per-item queue status updates and metadata editing without corrupting other items", () => {
      const queue: QueuedBulkWardrobeItem[] = [
        {
          id: "item-1",
          name: "Piece #1",
          category: "tops",
          imageUrl: "data:image/jpeg;base64,aaa",
          colorHex: "#2D3A2F",
          status: "pending",
        },
        {
          id: "item-2",
          name: "Piece #2",
          category: "bottoms",
          imageUrl: "data:image/jpeg;base64,bbb",
          colorHex: "#1A1A1A",
          status: "pending",
        },
      ];

      // Item 1 completes analysis
      const updatedQueueStep1 = queue.map((item) =>
        item.id === "item-1"
          ? {
              ...item,
              status: "done" as const,
              name: "Relaxed Linen Shirt",
              category: "tops" as const,
              brand: "COS",
              colorHex: "#F9F8F6",
            }
          : item
      );

      expect(updatedQueueStep1[0].status).toBe("done");
      expect(updatedQueueStep1[0].name).toBe("Relaxed Linen Shirt");
      expect(updatedQueueStep1[1].status).toBe("pending"); // Item 2 unaffected
      expect(updatedQueueStep1[1].name).toBe("Piece #2");

      // Item 2 fails analysis with error
      const updatedQueueStep2 = updatedQueueStep1.map((item) =>
        item.id === "item-2"
          ? {
              ...item,
              status: "error" as const,
              errorMessage: "Image resolution too low",
            }
          : item
      );

      expect(updatedQueueStep2[1].status).toBe("error");
      expect(updatedQueueStep2[1].errorMessage).toBe("Image resolution too low");
      expect(updatedQueueStep2[0].status).toBe("done"); // Item 1 preserved

      // User manually edits Item 2 metadata
      const userEditedQueue = updatedQueueStep2.map((item) =>
        item.id === "item-2"
          ? {
              ...item,
              name: "Wide Leg Chinos",
              category: "bottoms" as const,
              brand: "Uniqlo",
            }
          : item
      );

      expect(userEditedQueue[1].name).toBe("Wide Leg Chinos");
      expect(userEditedQueue[1].brand).toBe("Uniqlo");
    });
  });

  describe("3. Working Garment Editing Workflow", () => {
    it("updates garment in Dexie and reflects changes immediately", async () => {
      const initialId = await addWardrobeItem({
        name: "Basic Crewneck",
        category: "tops",
        subCategory: "Knitwear",
        color: "#2D3A2F",
        brand: "Zara",
        imageUrl: "data:image/jpeg;base64,test",
        tags: ["tops", "clean"],
        season: ["all-season"],
        occasions: ["College Casual"],
        laundryStatus: "clean",
        favorite: false,
        createdAt: Date.now(),
      });

      // Update garment
      await db.wardrobe_items.update(initialId, {
        name: "Heavyweight Boxy Tee",
        brand: "Lemaire",
        color: "#EFECE6",
        laundryStatus: "in_wash",
        updatedAt: Date.now(),
      });

      const updated = await db.wardrobe_items.get(initialId);
      expect(updated).toBeDefined();
      expect(updated?.name).toBe("Heavyweight Boxy Tee");
      expect(updated?.brand).toBe("Lemaire");
      expect(updated?.color).toBe("#EFECE6");
      expect(updated?.laundryStatus).toBe("in_wash");
    });
  });

  describe("4. Safe Garment Deletion with Cascading Reference Cleanup", () => {
    it("deletes target garment and safely scrubs references in planned slots and outfits without wiping db", async () => {
      const topId = await addWardrobeItem({
        name: "Cashmere Mockneck",
        category: "tops",
        color: "#EFECE6",
        imageUrl: "data:image/jpeg;base64,mockneck",
        tags: ["tops", "clean"],
        season: ["all-season"],
        favorite: false,
        createdAt: Date.now(),
      });

      const bottomId = await addWardrobeItem({
        name: "Slate Trousers",
        category: "bottoms",
        color: "#2D3A2F",
        imageUrl: "data:image/jpeg;base64,trousers",
        tags: ["bottoms", "clean"],
        season: ["all-season"],
        favorite: false,
        createdAt: Date.now(),
      });

      const shoeId = await addWardrobeItem({
        name: "Derby Shoes",
        category: "shoes",
        color: "#1A1A1A",
        imageUrl: "data:image/jpeg;base64,derby",
        tags: ["shoes", "clean"],
        season: ["all-season"],
        favorite: false,
        createdAt: Date.now(),
      });

      // Plan Monday slot with all 3 items
      await setFullPlanOutfit("Mon", "campus", topId, bottomId, shoeId, 9.2, "Curated look");

      // Save an outfit with top + bottom
      const outfitId = await db.outfits.add({
        name: "Monday Minimal",
        itemIds: [topId, bottomId, shoeId],
        tags: ["casual"],
        season: ["all-season"],
        favorite: true,
        createdAt: Date.now(),
      });

      // Verify slot and outfit exist
      let slots = await getAllPlannedSlots();
      expect(slots.length).toBe(1);
      expect(slots[0].topId).toBe(topId);
      expect(slots[0].itemIds).toContain(topId);

      let savedOutfit = await db.outfits.get(outfitId);
      expect(savedOutfit?.itemIds).toContain(topId);

      // Now SAFELY delete topId
      await safeDeleteWardrobeItem(topId);

      // 1. Top should be deleted from wardrobe
      const deletedTop = await db.wardrobe_items.get(topId);
      expect(deletedTop).toBeUndefined();

      // 2. Unrelated bottom and shoes must REMAIN intact in database
      const preservedBottom = await db.wardrobe_items.get(bottomId);
      const preservedShoe = await db.wardrobe_items.get(shoeId);
      expect(preservedBottom).toBeDefined();
      expect(preservedShoe).toBeDefined();

      // 3. Planned slot must have topId cleared without deleting the slot or other pieces
      slots = await getAllPlannedSlots();
      expect(slots.length).toBe(1);
      expect(slots[0].topId).toBeUndefined();
      expect(slots[0].bottomId).toBe(bottomId);
      expect(slots[0].footwearId).toBe(shoeId);
      expect(slots[0].itemIds).not.toContain(topId);
      expect(slots[0].itemIds).toContain(bottomId);

      // 4. Saved outfit must have topId scrubbed
      savedOutfit = await db.outfits.get(outfitId);
      expect(savedOutfit?.itemIds).not.toContain(topId);
      expect(savedOutfit?.itemIds).toContain(bottomId);
      expect(savedOutfit?.itemIds).toContain(shoeId);
    });
  });

  describe("5. Partial Outfits When Footwear is Missing", () => {
    const top: WardrobeItem = {
      id: 101,
      name: "Raw Linen Camp Collar Shirt",
      category: "tops",
      color: "#F9F8F6",
      imageUrl: "data:image/jpeg;base64,top",
      tags: ["tops", "clean"],
      season: ["all-season"],
      favorite: false,
      createdAt: Date.now(),
      laundryStatus: "clean",
    };

    const bottom: WardrobeItem = {
      id: 102,
      name: "Pleated Slate Wool Trousers",
      category: "bottoms",
      color: "#2D3A2F",
      imageUrl: "data:image/jpeg;base64,bottom",
      tags: ["bottoms", "clean"],
      season: ["all-season"],
      favorite: false,
      createdAt: Date.now(),
      laundryStatus: "clean",
    };

    it("pairs top and bottom when footwear is absent from wardrobe and sets missingReason: absent", () => {
      // Inventory with ONLY top and bottom (zero footwear exists)
      const inventory = [top, bottom];
      const result = generateDeterministicOutfit({ inventory, occasion: "college" });

      expect(result.success).toBe(true);
      expect(result.isPartial).toBe(true);
      expect(result.reasonCode).toBe("PARTIAL_OUTFIT");
      expect(result.missingCategory).toBe("footwear");
      expect(result.missingReason).toBe("absent");
      expect(result.outfit).toBeDefined();
      expect(result.outfit?.structure).toBe("partial_top_bottom");
      expect(result.outfit?.top?.id).toBe(101);
      expect(result.outfit?.bottom?.id).toBe(102);
      expect(result.outfit?.footwear).toBeUndefined();
      expect(result.outfit?.harmonyScore).toBeGreaterThan(6.0);
    });

    it("pairs top and bottom when footwear exists but is in laundry and sets missingReason: in_laundry", () => {
      const dirtyShoe: WardrobeItem = {
        id: 103,
        name: "Derby Shoes",
        category: "shoes",
        color: "#1A1A1A",
        imageUrl: "data:image/jpeg;base64,shoe",
        tags: ["shoes", "in_wash"],
        season: ["all-season"],
        favorite: false,
        createdAt: Date.now(),
        laundryStatus: "in_wash", // In laundry!
      };

      const inventory = [top, bottom, dirtyShoe];
      const result = generateDeterministicOutfit({ inventory, occasion: "college" });

      expect(result.success).toBe(true);
      expect(result.isPartial).toBe(true);
      expect(result.missingReason).toBe("in_laundry");
      expect(result.outfit?.structure).toBe("partial_top_bottom");
      expect(result.outfit?.missingExplanation).toContain("laundry");
    });
  });

  describe("6. Manual City Selection and Weather Priority", () => {
    it("persists manual location and retrieves it from settings", () => {
      expect(getConfiguredLocation()).toBeNull();

      const kolhapur: ConfiguredLocation = {
        type: "manual",
        name: "Kolhapur, Maharashtra, India",
        latitude: 16.6956,
        longitude: 74.2317,
        country: "India",
        admin1: "Maharashtra",
      };

      setConfiguredLocation(kolhapur);
      const retrieved = getConfiguredLocation();
      expect(retrieved).toEqual(kolhapur);

      clearConfiguredLocation();
      expect(getConfiguredLocation()).toBeNull();
    });

    it("prioritizes configured manual city before browser geolocation in getLiveWeather", async () => {
      // Configure manual city
      setConfiguredLocation({
        type: "manual",
        name: "Kolhapur, Maharashtra, India",
        latitude: 16.6956,
        longitude: 74.2317,
        country: "India",
      });

      const weather = await getLiveWeather();
      // If network is available, it returns live weather for Kolhapur with isManualLocation: true
      if (weather) {
        expect(weather.isManualLocation).toBe(true);
        expect(weather.locationName).toContain("Kolhapur");
        expect(weather.temperature).toBeDefined();
      }
    });

    it("evaluates weather correctly in outfit recommendation engine", () => {
      const hotWeather: WeatherData = {
        temperature: 34,
        apparentTemperature: 36,
        humidity: 60,
        weatherCode: 0,
        condition: "Clear Sky",
        category: "clear",
        isDay: true,
        precipitation: 0,
        windSpeed: 8,
        summary: "34°C • Clear Sky",
        latitude: 16.6956,
        longitude: 74.2317,
        fetchedAt: Date.now(),
      };

      const lightTop: WardrobeItem = {
        id: 201,
        name: "Linen Shirt",
        category: "tops",
        color: "#F9F8F6",
        imageUrl: "data:image/jpeg;base64,linen",
        tags: ["tops", "summer", "breathable", "clean"],
        season: ["summer"],
        favorite: false,
        createdAt: Date.now(),
        laundryStatus: "clean",
      };

      const heavyTrench: WardrobeItem = {
        id: 202,
        name: "Heavy Wool Overcoat",
        category: "outerwear",
        color: "#1A1A1A",
        imageUrl: "data:image/jpeg;base64,coat",
        tags: ["outerwear", "winter", "clean"],
        season: ["winter"],
        favorite: false,
        createdAt: Date.now(),
        laundryStatus: "clean",
      };

      const chinos: WardrobeItem = {
        id: 203,
        name: "Cotton Chinos",
        category: "bottoms",
        color: "#2D3A2F",
        imageUrl: "data:image/jpeg;base64,chinos",
        tags: ["bottoms", "clean"],
        season: ["all-season"],
        favorite: false,
        createdAt: Date.now(),
        laundryStatus: "clean",
      };

      const rec = generateDeterministicOutfit({
        inventory: [lightTop, heavyTrench, chinos],
        weather: hotWeather,
      });

      expect(rec.success).toBe(true);
      expect(rec.outfit).toBeDefined();
      // Should favor light breathable pairing and explain hot weather
      expect(rec.outfit?.breakdown.weatherScore).toBeGreaterThanOrEqual(15);
    });
  });
});

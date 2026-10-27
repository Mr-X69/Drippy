import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  db,
  seedInitialWardrobeIfEmpty,
  loadSampleWardrobe,
  isSampleGarment,
  getAllWardrobeItems,
  INITIAL_GARMENTS,
  type WardrobeItem,
} from "@/lib/db";
import { getNeutralPlaceholder, isPlaceholderImage } from "@/lib/placeholders";

describe("Phase 1: Wardrobe Data Integrity & Test Foundation", () => {
  beforeEach(async () => {
    // Ensure clean state before each test
    await db.wardrobe_items.clear();
    await db.outfits.clear();
    await db.planned_slots.clear();
  });

  describe("1. Wardrobe Initialization & Anti-Demo-Injection", () => {
    it("fresh wardrobe starts completely empty and does not silently inject items", async () => {
      const initialCount = await db.wardrobe_items.count();
      expect(initialCount).toBe(0);

      // Calling seedInitialWardrobeIfEmpty must be purely read-only
      const items = await seedInitialWardrobeIfEmpty();
      expect(items).toEqual([]);

      // Database count must remain strictly 0
      const afterCount = await db.wardrobe_items.count();
      expect(afterCount).toBe(0);
    });

    it("does not assume an empty wardrobe requires gym items or hardcoded garments", async () => {
      await seedInitialWardrobeIfEmpty();
      const allItems = await db.wardrobe_items.toArray();
      const activewearItems = allItems.filter(
        (item) => item.category === "Activewear" || item.subCategory?.toLowerCase().includes("gym")
      );
      expect(activewearItems.length).toBe(0);
      expect(allItems.length).toBe(0);
    });

    it("populates sample data ONLY when user explicitly triggers loadSampleWardrobe", async () => {
      expect(await db.wardrobe_items.count()).toBe(0);

      const loaded = await loadSampleWardrobe();
      expect(loaded.length).toBe(INITIAL_GARMENTS.length);

      const dbCount = await db.wardrobe_items.count();
      expect(dbCount).toBe(INITIAL_GARMENTS.length);

      // Verify every loaded sample item is marked as a sample
      loaded.forEach((item) => {
        expect(item.isSample).toBe(true);
        expect(isSampleGarment(item)).toBe(true);
      });
    });
  });

  describe("2. Image Fallbacks & Neutral Placeholders", () => {
    it("generates an intentional SVG placeholder with category and 'No photo' text", () => {
      const placeholder = getNeutralPlaceholder("Top", "#2D3A2F");

      expect(placeholder.startsWith("data:image/svg+xml;utf8,")).toBe(true);
      expect(placeholder).toContain("No%20photo");
      expect(placeholder).toContain("Top");
      expect(placeholder).not.toContain("unsplash.com");
    });

    it("correctly identifies placeholder URIs vs genuine images", () => {
      const placeholder = getNeutralPlaceholder("Bottom", "#1A1A1A");
      expect(isPlaceholderImage(placeholder)).toBe(true);

      const realUrl = "https://images.unsplash.com/photo-1541099649105-f69ad21f3246";
      expect(isPlaceholderImage(realUrl)).toBe(false);

      expect(isPlaceholderImage("")).toBe(false);
      expect(isPlaceholderImage(undefined)).toBe(false);
    });

    it("provides fallback for all standard garment categories without crashing", () => {
      const categories: WardrobeItem["category"][] = [
        "Top",
        "Bottom",
        "Footwear",
        "Outerwear",
        "Accessory",
        "One-Piece",
        "Activewear",
      ];

      categories.forEach((cat) => {
        const svgUri = getNeutralPlaceholder(cat);
        expect(svgUri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
        expect(svgUri).toContain(encodeURIComponent(cat));
      });
    });
  });

  describe("3. Data Sanitization of Sample Seeds", () => {
    it("INITIAL_GARMENTS contains zero human face portraits or unrelated lifestyle shots", () => {
      // These specific portrait photo IDs were identified during audit as showing human faces/heads
      const forbiddenPortraitIds = [
        "photo-1544923246-77307dd654cb", // portrait of woman in yellow beanie used for wool coat
        "photo-1539571696357-5a69c17a67c6", // portrait of man looking over shoulder used for trench coat
      ];

      INITIAL_GARMENTS.forEach((item) => {
        forbiddenPortraitIds.forEach((badId) => {
          expect(item.imageUrl).not.toContain(badId);
        });
      });
    });

    it("every seed garment has valid, non-conflicting categories and required fields", () => {
      const validCategories = ["tops", "bottoms", "outerwear", "shoes", "accessories", "one-piece"];

      INITIAL_GARMENTS.forEach((item) => {
        expect(validCategories).toContain(item.category);
        expect(item.name.trim().length).toBeGreaterThan(0);
        expect((item.brand ?? "").trim().length).toBeGreaterThan(0);
        expect(item.imageUrl.trim().length).toBeGreaterThan(0);
        expect(item.isSample).toBe(true);
      });
    });
  });

  describe("4. Protecting Existing User Data", () => {
    it("distinguishes genuine user garments from sample garments", async () => {
      const userItem: Omit<WardrobeItem, "id"> = {
        name: "Vintage 1990 Levi 501",
        category: "bottoms",
        color: "#2B3A42",
        brand: "Levi Strauss",
        imageUrl: "data:image/png;base64,genuineUserData123",
        favorite: true,
        tags: ["vintage", "denim"],
        season: ["all-season"],
        laundryStatus: "clean",
        createdAt: Date.now(),
        isSample: false,
      };

      const id = await db.wardrobe_items.add(userItem as WardrobeItem);
      const savedUserItem = await db.wardrobe_items.get(id);

      expect(savedUserItem).toBeDefined();
      expect(isSampleGarment(savedUserItem!)).toBe(false);
    });

    it("never overwrites or clears existing user records during initialization checks", async () => {
      // Add custom user garment
      const userGarment: Omit<WardrobeItem, "id"> = {
        name: "Acne Studios Cashmere Sweater",
        category: "tops",
        color: "#E2D9C8",
        brand: "Acne Studios",
        imageUrl: "https://example.com/cashmere.jpg",
        favorite: true,
        tags: ["knitwear"],
        season: ["winter"],
        laundryStatus: "clean",
        createdAt: 1700000000000,
        isSample: false,
      };

      const addedId = await db.wardrobe_items.add(userGarment as WardrobeItem);

      // Execute initialization helper
      const results = await seedInitialWardrobeIfEmpty();

      // Ensure user garment is returned intact
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(addedId);
      expect(results[0].name).toBe("Acne Studios Cashmere Sweater");

      // Verify database still holds the user garment
      const fromDb = await db.wardrobe_items.get(addedId);
      expect(fromDb?.name).toBe("Acne Studios Cashmere Sweater");
      expect(fromDb?.brand).toBe("Acne Studios");
      expect(await db.wardrobe_items.count()).toBe(1);
    });

    it("getAllWardrobeItems correctly filters laundry status without altering records", async () => {
      await db.wardrobe_items.bulkAdd([
        {
          name: "Clean Oxford Shirt",
          category: "tops",
          color: "#FFFFFF",
          brand: "Drippy",
          imageUrl: "https://example.com/shirt.jpg",
          favorite: false,
          tags: ["classic"],
          season: ["all-season"],
          laundryStatus: "clean",
          createdAt: Date.now(),
        },
        {
          name: "Washed Denim",
          category: "bottoms",
          color: "#4A6B82",
          brand: "Drippy",
          imageUrl: "https://example.com/denim.jpg",
          favorite: false,
          tags: ["denim"],
          season: ["all-season"],
          laundryStatus: "in_wash",
          createdAt: Date.now() - 100,
        },
      ]);

      const allItems = await getAllWardrobeItems(false);
      expect(allItems.length).toBe(2);

      const cleanItems = await getAllWardrobeItems(true);
      expect(cleanItems.length).toBe(1);
      expect(cleanItems[0].name).toBe("Clean Oxford Shirt");
    });
  });
});

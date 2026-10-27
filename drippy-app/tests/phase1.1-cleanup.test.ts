import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  db,
  isSampleGarment,
  auditWardrobeRecords,
  pruneDuplicateSamples,
  sanitizeMislabeledSampleImages,
  purgeAllLegacySamples,
  clearWardrobeAndPlannerData,
  type WardrobeItem,
} from "@/lib/db";
import { isPlaceholderImage } from "@/lib/placeholders";

describe("Phase 1.1: Wardrobe Data Cleanup & Preservation", () => {
  beforeEach(async () => {
    await db.wardrobe_items.clear();
    await db.outfits.clear();
    await db.planned_slots.clear();
  });

  const mockUserItem: Omit<WardrobeItem, "id"> = {
    name: "Relaxed Linen Button-Down Shirt",
    category: "tops",
    color: "#E6C641",
    brand: "Unassigned",
    imageUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...",
    tags: ["vintage", "linen"],
    season: ["summer", "fall"],
    favorite: true,
    laundryStatus: "clean",
    createdAt: 1792446733246,
    isSample: false,
  };

  const mockLegacyOvercoatWithPortrait: Omit<WardrobeItem, "id"> = {
    name: "Double-Breasted Wool Overcoat",
    category: "outerwear",
    color: "#1A1A1A",
    brand: "The Row",
    imageUrl: "https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=800&q=80",
    tags: ["editorial", "structured"],
    season: ["fall", "winter"],
    favorite: true,
    createdAt: 1790000000000,
  };

  const mockLegacyDumbbellShoe: Omit<WardrobeItem, "id"> = {
    name: "Cloudswift Lightweight Road Runners",
    category: "shoes",
    color: "#FFFFFF",
    brand: "On Running",
    imageUrl: "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80",
    tags: ["Gym", "Activewear", "running"],
    season: ["all-season"],
    favorite: false,
    createdAt: 1790000001000,
  };

  describe("1. Sample Identification Rules", () => {
    it("never classifies a genuine user upload as a sample, even with matching names", () => {
      // User creates a garment with the name of a staple, but their own image
      const userItemWithNameConflict: WardrobeItem = {
        id: 101,
        name: "Double-Breasted Wool Overcoat", // Same name as seed
        category: "outerwear",
        color: "#000000",
        brand: "Custom Tailor",
        imageUrl: "data:image/jpeg;base64,myOwnCustomPhotoBytes...",
        tags: ["tailored"],
        season: ["winter"],
        favorite: false,
        createdAt: Date.now(),
      };

      expect(isSampleGarment(userItemWithNameConflict)).toBe(false);
      expect(isSampleGarment({ ...mockUserItem, id: 17 })).toBe(false);
    });

    it("reliably detects legacy sample images based on known seed URLs", () => {
      expect(isSampleGarment({ ...mockLegacyOvercoatWithPortrait, id: 3 })).toBe(true);
      expect(isSampleGarment({ ...mockLegacyDumbbellShoe, id: 23 })).toBe(true);
    });
  });

  describe("2. Audit & Categorization", () => {
    it("correctly audits a mixed database into genuine, legacy, duplicate, and mislabeled sets", async () => {
      // Setup: 1 user item, 2 unique samples (both mislabeled), 2 duplicates of those samples
      await db.wardrobe_items.bulkAdd([
        mockUserItem, // ID 1
        mockLegacyOvercoatWithPortrait, // ID 2
        mockLegacyDumbbellShoe, // ID 3
        mockLegacyOvercoatWithPortrait, // ID 4 (duplicate of ID 2)
        mockLegacyDumbbellShoe, // ID 5 (duplicate of ID 3)
      ]);

      const audit = await auditWardrobeRecords();
      expect(audit.total).toBe(5);
      expect(audit.genuine.length).toBe(1);
      expect(audit.genuine[0].name).toBe("Relaxed Linen Button-Down Shirt");
      expect(audit.legacySamples.length).toBe(2);
      expect(audit.duplicateSamples.length).toBe(2);
      expect(audit.mislabeledImageSamples.length).toBe(4); // both IDs 2, 3, 4, 5 use portrait/dumbbell URLs
    });
  });

  describe("3. Safe Duplicate Pruning", () => {
    it("prunes ONLY duplicate sample records while preserving primary samples and user items", async () => {
      const uId = await db.wardrobe_items.add({ ...mockUserItem } as WardrobeItem);
      const s1 = await db.wardrobe_items.add({ ...mockLegacyOvercoatWithPortrait } as WardrobeItem);
      const s2 = await db.wardrobe_items.add({ ...mockLegacyDumbbellShoe } as WardrobeItem);
      const dup1 = await db.wardrobe_items.add({ ...mockLegacyOvercoatWithPortrait } as WardrobeItem);
      const dup2 = await db.wardrobe_items.add({ ...mockLegacyDumbbellShoe } as WardrobeItem);

      expect(await db.wardrobe_items.count()).toBe(5);

      const result = await pruneDuplicateSamples();
      expect(result.removedCount).toBe(2);
      expect(result.remainingCount).toBe(3);

      // Verify the genuine user garment survived
      const preservedUser = await db.wardrobe_items.get(uId);
      expect(preservedUser).toBeDefined();
      expect(preservedUser?.name).toBe("Relaxed Linen Button-Down Shirt");

      // Verify primary samples survived
      expect(await db.wardrobe_items.get(s1)).toBeDefined();
      expect(await db.wardrobe_items.get(s2)).toBeDefined();

      // Verify duplicates were removed
      expect(await db.wardrobe_items.get(dup1)).toBeUndefined();
      expect(await db.wardrobe_items.get(dup2)).toBeUndefined();
    });
  });

  describe("4. Mislabeled Image Sanitization", () => {
    it("replaces portraits and dumbbells with neutral SVG placeholders, leaving user images intact", async () => {
      const uId = await db.wardrobe_items.add({ ...mockUserItem } as WardrobeItem);
      const s1 = await db.wardrobe_items.add({ ...mockLegacyOvercoatWithPortrait } as WardrobeItem);
      const s2 = await db.wardrobe_items.add({ ...mockLegacyDumbbellShoe } as WardrobeItem);

      const updatedCount = await sanitizeMislabeledSampleImages();
      expect(updatedCount).toBe(2);

      // Verify genuine user image was not changed
      const userItem = await db.wardrobe_items.get(uId);
      expect(userItem?.imageUrl).toBe(mockUserItem.imageUrl);

      // Verify sample images are now clean neutral placeholders
      const cleanedOvercoat = await db.wardrobe_items.get(s1);
      expect(cleanedOvercoat?.imageUrl).not.toContain("photo-1544923246-77307dd654cb");
      expect(isPlaceholderImage(cleanedOvercoat?.imageUrl)).toBe(true);

      const cleanedShoe = await db.wardrobe_items.get(s2);
      expect(cleanedShoe?.imageUrl).not.toContain("photo-1584735935682-2f2b69dff9d2");
      expect(isPlaceholderImage(cleanedShoe?.imageUrl)).toBe(true);
    });
  });

  describe("5. Complete Legacy Purge with Strict User Preservation", () => {
    it("removes all legacy samples and retains only genuine user items", async () => {
      const uId = await db.wardrobe_items.add({ ...mockUserItem } as WardrobeItem);
      await db.wardrobe_items.add({ ...mockLegacyOvercoatWithPortrait } as WardrobeItem);
      await db.wardrobe_items.add({ ...mockLegacyDumbbellShoe } as WardrobeItem);

      expect(await db.wardrobe_items.count()).toBe(3);

      const result = await purgeAllLegacySamples();
      expect(result.removedCount).toBe(2);
      expect(result.genuinePreservedCount).toBe(1);

      const remaining = await db.wardrobe_items.toArray();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(uId);
      expect(remaining[0].name).toBe("Relaxed Linen Button-Down Shirt");
      expect(remaining[0].color).toBe("#E6C641");
    });
  });

  describe("6. Complete Inventory Reset (Pristine Database)", () => {
    it("clears all garments, outfits, and planned slots, eliminating broken references", async () => {
      // Setup: add garments, outfit, and planned slot
      const gId = await db.wardrobe_items.add({ ...mockUserItem } as WardrobeItem);
      await db.outfits.add({
        name: "Test Look",
        itemIds: [gId],
        tags: ["casual"],
        season: ["all-season"],
        favorite: false,
        createdAt: Date.now(),
      });
      await db.planned_slots.add({
        day: "Mon",
        track: "campus",
        topId: gId,
        itemIds: [gId],
        updatedAt: Date.now(),
      });

      expect(await db.wardrobe_items.count()).toBe(1);
      expect(await db.outfits.count()).toBe(1);
      expect(await db.planned_slots.count()).toBe(1);

      // Execute authorized complete inventory reset
      await clearWardrobeAndPlannerData();

      expect(await db.wardrobe_items.count()).toBe(0);
      expect(await db.outfits.count()).toBe(0);
      expect(await db.planned_slots.count()).toBe(0);
    });
  });
});

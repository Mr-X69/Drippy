"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  Search,
  Plus,
  Heart,
  X,
  Layers,
  Check,
  Waves,
  Edit3,
  Trash2,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  toggleFavoriteItem,
  toggleLaundryStatus,
  safeDeleteWardrobeItem,
  WardrobeItem,
} from "@/lib/db";
import { getNeutralPlaceholder } from "@/lib/placeholders";
import { cn } from "@/lib/utils";
import AddGarmentModal from "@/components/AddGarmentModal";
import EditGarmentModal from "@/components/EditGarmentModal";

const CATEGORIES: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Tops", value: "tops" },
  { label: "Bottoms", value: "bottoms" },
  { label: "Outerwear", value: "outerwear" },
  { label: "Shoes", value: "shoes" },
  { label: "Accessories", value: "accessories" },
  { label: "Favorites", value: "favorites" },
  { label: "In Wash", value: "in_wash" },
];

export default function ClosetPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);

  // Reactive live query that automatically updates whenever wardrobe_items change in Dexie
  const liveItems = useLiveQuery(
    () => db.wardrobe_items.reverse().sortBy("createdAt"),
    []
  );

  const isLoading = liveItems === undefined;

  // Total count of items currently in laundry
  const inLaundryCount = useMemo(() => {
    return (liveItems ?? []).filter((item) => item.laundryStatus === "in_wash").length;
  }, [liveItems]);

  // Handle Delete Garment with confirmation and safe reference cleanup
  const handlePromptDelete = async (e: React.MouseEvent, item: WardrobeItem) => {
    e.stopPropagation();
    if (!item.id) return;
    const confirmed = confirm(
      `Delete "${item.name}" from your wardrobe? This piece will be safely removed from planned slots.`
    );
    if (!confirmed) return;
    try {
      await safeDeleteWardrobeItem(item.id);
      setToastText(`"${item.name}" removed from wardrobe.`);
      setTimeout(() => setToastText(null), 3000);
    } catch (err) {
      console.error("Failed to delete garment:", err);
    }
  };

  // Handle Favorite Toggle in Dexie (useLiveQuery automatically re-renders)
  const handleToggleFavorite = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (!id) return;
    try {
      await toggleFavoriteItem(id);
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  // Handle Laundry State Toggle in Dexie
  const handleToggleLaundry = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (!id) return;
    try {
      const nextStatus = await toggleLaundryStatus(id);
      setToastText(
        nextStatus === "in_wash"
          ? "Piece marked as In Laundry — excluded from active styling"
          : "Piece marked Clean — available for styling"
      );
      setTimeout(() => setToastText(null), 2500);
    } catch (err) {
      console.error("Failed to toggle laundry status:", err);
    }
  };

  // Filtered Items (Client-side search & category filtering)
  const filteredItems = useMemo(() => {
    const items = liveItems ?? [];
    return items.filter((item) => {
      // Category / Status filter
      if (selectedCategory === "favorites" && !item.favorite) return false;
      if (selectedCategory === "in_wash" && item.laundryStatus !== "in_wash") return false;
      if (
        selectedCategory !== "all" &&
        selectedCategory !== "favorites" &&
        selectedCategory !== "in_wash" &&
        item.category.toLowerCase() !== selectedCategory.toLowerCase()
      ) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesBrand = item.brand?.toLowerCase().includes(query);
        const matchesColor = item.color?.toLowerCase().includes(query);
        const matchesSub = item.subCategory?.toLowerCase().includes(query);
        const matchesTags = item.tags?.some((t) => t.toLowerCase().includes(query));
        if (!matchesName && !matchesBrand && !matchesColor && !matchesSub && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [liveItems, selectedCategory, searchQuery]);

  return (
    <div className="flex flex-col min-h-screen text-[#1A1A1A] pb-28">
      {/* Sticky Top Header with Generous Space & No Heavy Borders */}
      <header className="sticky top-0 z-40 bg-[#F9F8F6]/95 backdrop-blur-md px-5 pt-4 pb-2.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[9px] font-semibold tracking-[0.26em] text-[#8C887B] uppercase block">
              Editorial Closet
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[#1A1A1A] mt-0.5">
              Drippy
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className={cn(
                "p-2 rounded-full transition-all duration-200",
                isSearchOpen
                  ? "bg-[#2D3A2F] text-[#F9F8F6]"
                  : "bg-[#F0EDE6] text-[#1A1A1A] hover:bg-[#E8E4DA]"
              )}
              aria-label="Toggle search"
            >
              <Search size={16} strokeWidth={2} />
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 bg-[#2D3A2F] text-[#F9F8F6] px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 hover:bg-[#222c24] active:scale-95 shadow-sm"
              aria-label="Add garment"
            >
              <Plus size={14} strokeWidth={2.4} />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Collapsible Search Input */}
        {isSearchOpen && (
          <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="relative">
              <input
                type="text"
                placeholder="Search garments, brands, tones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-[#F0EDE6] rounded-xl px-9 py-2 text-xs text-[#1A1A1A] placeholder-[#8C887B] focus:outline-none focus:ring-1 focus:ring-[#2D3A2F]"
              />
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C887B]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C887B] hover:text-[#1A1A1A]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Horizontal Category Pill Carousel */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-3 pb-1 -mx-5 px-5 scroll-smooth">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.value;
            const isLaundryTab = cat.value === "in_wash";
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={cn(
                  "whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all duration-200 select-none active:scale-95 flex items-center gap-1.5",
                  isActive
                    ? "bg-[#2D3A2F] text-[#F9F8F6] shadow-sm font-semibold"
                    : "bg-[#F0EDE6] text-[#8C887B] hover:text-[#1A1A1A] hover:bg-[#E8E4DA]"
                )}
              >
                {isLaundryTab && (
                  <Waves
                    size={12}
                    className={isActive ? "text-cyan-300" : "text-[#8C887B]"}
                  />
                )}
                <span>{cat.label}</span>
                {isLaundryTab && inLaundryCount > 0 && (
                  <span
                    className={cn(
                      "text-[9px] px-1.5 py-0.2 rounded-full font-bold",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-[#8C887B]/20 text-[#1A1A1A]"
                    )}
                  >
                    {inLaundryCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Grid Meta Information Bar with Generous Breathing Room */}
      <section className="px-5 pt-3 pb-2 flex items-center justify-between text-xs text-[#8C887B]">
        <span className="font-normal tracking-wide">
          Showing <span className="font-semibold text-[#1A1A1A]">{filteredItems.length}</span>{" "}
          {filteredItems.length === 1 ? "piece" : "pieces"}
        </span>
        <span className="text-[10px] tracking-wider text-[#8C887B]">
          {inLaundryCount > 0 ? `${inLaundryCount} in wash` : "All pieces clean"}
        </span>
      </section>

      {/* Clean Asymmetric 2-Column Grid (Strict 3:4 Aspect Ratio, Minimalist, No Heavy Borders) */}
      <main className="flex-1 px-5 pt-1">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 items-start">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col gap-2.5",
                  i % 2 === 0 && "mt-7 sm:mt-8"
                )}
              >
                <div className="aspect-[3/4] rounded-2xl bg-[#F0EDE6] animate-pulse" />
                <div className="h-3.5 bg-[#F0EDE6] rounded w-3/4 animate-pulse" />
                <div className="h-2.5 bg-[#F0EDE6] rounded w-1/2 animate-pulse" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-24 px-6 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[#F0EDE6] flex items-center justify-center text-[#8C887B] mb-3">
              <Layers size={20} strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-semibold text-[#1A1A1A] tracking-tight">
              No garments found
            </h3>
            <p className="text-xs text-[#8C887B] mt-1 max-w-[210px] leading-relaxed">
              {selectedCategory === "in_wash"
                ? "No garments are currently in the laundry."
                : "Try clearing your search or switching to another category."}
            </p>
            {(searchQuery || selectedCategory !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="mt-4 px-4 py-1.5 rounded-full bg-[#1A1A1A] text-[#F9F8F6] text-xs font-medium tracking-wide transition-all hover:bg-black active:scale-95 shadow-xs"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 items-start">
            {filteredItems.map((item, index) => {
              const isEvenColumn = index % 2 === 1;
              const isInWash = item.laundryStatus === "in_wash";

              return (
                <article
                  key={item.id}
                  onClick={() => setEditingItem(item)}
                  className={cn(
                    "group flex flex-col select-none transition-all duration-300 cursor-pointer",
                    isEvenColumn && "mt-7 sm:mt-8", // Asymmetric vertical stagger
                    isInWash && "opacity-50 grayscale contrast-90" // Visually greyed out when in laundry
                  )}
                >
                  {/* Strict 3:4 Aspect Ratio Photo Container (No heavy borders, generous curves) */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#F0EDE6] shadow-[0_4px_24px_rgba(0,0,0,0.03)] transition-transform duration-500 group-hover:scale-[1.015]">
                    <Image
                      src={
                        item.imageUrl?.trim()
                          ? item.imageUrl
                          : getNeutralPlaceholder(item.category, item.color)
                      }
                      alt={item.name}
                      fill
                      unoptimized
                      sizes="(max-width: 448px) 50vw, 220px"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      priority={index < 4}
                    />

                    {/* Subtle top scrim for badge legibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10 opacity-50 pointer-events-none" />

                    {/* Category Pill (Top-Left) */}
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-[#F9F8F6]/85 backdrop-blur-md text-[8px] font-semibold tracking-[0.16em] uppercase text-[#1A1A1A] shadow-2xs">
                      {item.category}
                    </span>

                    {/* Favorite Heart Button (Top-Right) */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleFavorite(e, item.id)}
                      className={cn(
                        "absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-md shadow-2xs active:scale-90",
                        item.favorite
                          ? "bg-[#F9F8F6] text-[#C46D52]"
                          : "bg-[#F9F8F6]/80 text-[#8C887B] hover:text-[#1A1A1A]"
                      )}
                      aria-label={item.favorite ? "Unfavorite item" : "Favorite item"}
                    >
                      <Heart
                        size={13}
                        strokeWidth={2}
                        className={cn(
                          "transition-transform",
                          item.favorite && "fill-[#C46D52] scale-110"
                        )}
                      />
                    </button>

                    {/* Bottom Status / Tone Indicator on Image */}
                    {isInWash ? (
                      <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-white text-[9px] font-medium tracking-wide shadow-2xs">
                        <Waves size={10} className="text-cyan-300" />
                        <span>In Wash</span>
                      </span>
                    ) : (
                      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#F9F8F6]/90 backdrop-blur-md shadow-2xs">
                        <span
                          className="w-1.5 h-1.5 rounded-full border border-black/15 shadow-2xs"
                          style={{ backgroundColor: item.color || "#1A1A1A" }}
                        />
                        <span className="text-[8px] font-semibold tracking-wider text-[#1A1A1A] uppercase">
                          {item.subCategory || "Staple"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Garment Details & Editorial Typography */}
                  <div className="pt-2.5 px-0.5 flex flex-col">
                    {/* Garment Name in crisp, bold font with subtle #2D3A2F hover accent */}
                    <h3 className="text-xs font-bold text-[#1A1A1A] tracking-tight truncate group-hover:text-[#2D3A2F] transition-colors leading-snug">
                      {item.name}
                    </h3>

                    {/* Brand and Color in muted secondary text underneath */}
                    <div className="flex items-center justify-between text-[11px] text-[#8C887B] mt-0.5">
                      <span className="truncate">{item.brand || "Drippy Archive"}</span>
                      {item.color && (
                        <span className="text-[10px] text-[#8C887B]/80 font-normal flex items-center gap-1 flex-shrink-0">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="capitalize">{item.subCategory || item.category}</span>
                        </span>
                      )}
                    </div>

                    {/* Feature: Minimal "In Laundry" Toggle Button & Edit / Delete Actions */}
                    <div className="mt-2.5 flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleToggleLaundry(e, item.id)}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wide transition-all select-none active:scale-95 shadow-2xs",
                          isInWash
                            ? "bg-[#1A1A1A] text-[#F9F8F6] hover:bg-black font-semibold"
                            : "bg-[#F0EDE6] text-[#8C887B] hover:text-[#2D3A2F] hover:bg-[#EAE6DC]"
                        )}
                        title={isInWash ? "Mark Clean" : "Send to Laundry"}
                      >
                        <Waves
                          size={11}
                          className={cn(
                            isInWash
                              ? "text-cyan-300"
                              : "text-[#8C887B] group-hover:text-[#2D3A2F]"
                          )}
                        />
                        <span>{isInWash ? "In Laundry" : "Clean"}</span>
                      </button>

                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem(item);
                          }}
                          aria-label={`Edit ${item.name}`}
                          className="p-1 rounded-full text-[#8C887B] hover:text-[#1A1A1A] hover:bg-[#EFECE6] transition-colors"
                          title="Edit garment"
                        >
                          <Edit3 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handlePromptDelete(e, item)}
                          aria-label={`Delete ${item.name}`}
                          className="p-1 rounded-full text-[#8C887B] hover:text-[#9A4C3D] hover:bg-[#FDF2F0] transition-colors"
                          title="Delete garment"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Prominent Floating Action Button (FAB) fixed above BottomNav */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        aria-label="Add new garment to wardrobe"
        className="fixed bottom-24 right-5 sm:right-[calc(50%-14rem+1.25rem)] z-40 w-13 h-13 rounded-full bg-[#2D3A2F] text-[#F9F8F6] shadow-[0_6px_22px_rgba(45,58,47,0.38)] flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-[#222c24] border border-white/20 group"
      >
        <Plus
          size={24}
          strokeWidth={2.4}
          className="group-hover:rotate-90 transition-transform duration-300"
        />
      </button>

      {/* Editorial Add Garment Slide-Up Bottom Sheet Modal */}
      <AddGarmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onGarmentAdded={() => {
          setToastText("Piece cataloged to your collection!");
          setTimeout(() => setToastText(null), 3000);
        }}
      />

      {/* Editorial Edit Garment Slide-Up Bottom Sheet Modal */}
      <EditGarmentModal
        item={editingItem}
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        onGarmentUpdated={(updated) => {
          setToastText(`Updated "${updated.name}"`);
          setTimeout(() => setToastText(null), 3000);
        }}
        onGarmentDeleted={() => {
          setToastText("Piece removed from wardrobe.");
          setTimeout(() => setToastText(null), 3000);
        }}
      />

      {/* Confirmation Toast */}
      {toastText && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1A1A1A] text-[#F9F8F6] px-4 py-2 rounded-full text-xs font-medium tracking-wide flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check size={14} className="text-emerald-400" strokeWidth={3} />
          <span>{toastText}</span>
        </div>
      )}
    </div>
  );
}

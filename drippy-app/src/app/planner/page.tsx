"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  GraduationCap,
  Footprints,
  Briefcase,
  Utensils,
  Dumbbell,
  Sparkles,
  Plus,
  Check,
  X,
  Trash2,
  RotateCw,
  ShieldCheck,
  Layers,
  AlertTriangle,
  Moon,
  Shirt,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  setPlanSlotPiece,
  setFullPlanOutfit,
  setDayOccasion,
  clearPlanSlot,
  type DayOfWeek,
  type TrackType,
  type WardrobeItem,
  type PlanSlot,
  type PlannerRole,
} from "@/lib/db";
import {
  generateDeterministicOutfit,
  type OutfitOccasion,
} from "@/lib/outfit-engine";
import { getNeutralPlaceholder } from "@/lib/placeholders";
import { getLiveWeather, type WeatherData } from "@/lib/weather";
import { cn } from "@/lib/utils";

// 7 Customizable Days
interface DayConfig {
  day: DayOfWeek;
  label: string;
  fullLabel: string;
}

const WEEK_DAYS: DayConfig[] = [
  { day: "Mon", label: "Mon", fullLabel: "Monday" },
  { day: "Tue", label: "Tue", fullLabel: "Tuesday" },
  { day: "Wed", label: "Wed", fullLabel: "Wednesday" },
  { day: "Thu", label: "Thu", fullLabel: "Thursday" },
  { day: "Fri", label: "Fri", fullLabel: "Friday" },
  { day: "Sat", label: "Sat", fullLabel: "Saturday" },
  { day: "Sun", label: "Sun", fullLabel: "Sunday" },
];

// Configurable Occasions
interface OccasionOption {
  id: OutfitOccasion;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const OCCASION_OPTIONS: OccasionOption[] = [
  { id: "college", label: "College", icon: GraduationCap },
  { id: "casual", label: "Casual", icon: Footprints },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "dinner", label: "Dinner", icon: Utensils },
  { id: "gym", label: "Gym", icon: Dumbbell },
  { id: "outing", label: "Outing", icon: Footprints },
];

type DrawerRole = "tops" | "bottoms" | "shoes" | "one_piece" | "outerwear";

const ROLE_LABELS: Record<DrawerRole, { label: string; placeholder: string }> = {
  tops: { label: "Top", placeholder: "Select Top" },
  bottoms: { label: "Bottom", placeholder: "Select Bottom" },
  shoes: { label: "Footwear", placeholder: "Select Shoes" },
  one_piece: { label: "Dress / One-Piece", placeholder: "Select Dress" },
  outerwear: { label: "Outerwear", placeholder: "Select Layer" },
};

export default function WeeklyPlannerPage() {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("Mon");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSlotTrack, setActiveSlotTrack] = useState<TrackType>("campus");
  const [activeSlotRole, setActiveSlotRole] = useState<DrawerRole>("tops");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic Open-Meteo Weather State (Strictly null if denied/timed out)
  const [liveWeather, setLiveWeather] = useState<WeatherData | null>(null);

  // Auto-Curate state
  const [isCurating, setIsCurating] = useState(false);
  const [curateStageText, setCurateStageText] = useState<string>("");

  // Attempt silent location probe on mount if permission was granted previously
  useEffect(() => {
    if (typeof window !== "undefined" && "permissions" in navigator) {
      navigator.permissions
        ?.query({ name: "geolocation" as PermissionName })
        .then((result) => {
          if (result.state === "granted") {
            getLiveWeather().then((w) => setLiveWeather(w));
          }
        })
        .catch(() => {});
    }
  }, []);

  // Read all wardrobe items live from Dexie
  const liveWardrobeItems = useLiveQuery(
    () => db.wardrobe_items.toArray(),
    []
  );

  // Read all planned slots live from Dexie
  const livePlannedSlots = useLiveQuery(
    () => db.planned_slots.toArray(),
    []
  );

  // Map of wardrobe items by ID for O(1) lookup
  const itemsById = useMemo(() => {
    const map = new Map<number, WardrobeItem>();
    (liveWardrobeItems ?? []).forEach((item) => {
      if (item.id) map.set(item.id, item);
    });
    return map;
  }, [liveWardrobeItems]);

  // Clean wardrobe items where laundryStatus !== "in_wash"
  const cleanWardrobeItems = useMemo(() => {
    return (liveWardrobeItems ?? []).filter((item) => {
      const inWash =
        item.laundryStatus === "in_wash" ||
        (item as unknown as { inLaundry?: boolean }).inLaundry === true;
      return !inWash;
    });
  }, [liveWardrobeItems]);

  // Active day config
  const currentDayConfig = useMemo(() => {
    return WEEK_DAYS.find((d) => d.day === selectedDay) ?? WEEK_DAYS[0];
  }, [selectedDay]);

  // Find planned slots for selected day
  const campusSlot = useMemo(() => {
    return (livePlannedSlots ?? []).find(
      (s) => s.day === selectedDay && s.track === "campus"
    );
  }, [livePlannedSlots, selectedDay]);

  const gymSlot = useMemo(() => {
    return (livePlannedSlots ?? []).find(
      (s) => s.day === selectedDay && s.track === "gym"
    );
  }, [livePlannedSlots, selectedDay]);

  // Day occasion and rest status
  const isRestDay = Boolean(campusSlot?.isRestDay);
  const currentOccasion: OutfitOccasion = (campusSlot?.occasion as OutfitOccasion) || (
    ["Sat", "Sun"].includes(selectedDay) ? "casual" : "college"
  );

  // Helper to extract resolved pieces and handle deleted/in-wash items
  const resolveSlotState = useCallback((slot?: PlanSlot) => {
    if (!slot) {
      return {
        top: undefined,
        bottom: undefined,
        footwear: undefined,
        onePiece: undefined,
        outerwear: undefined,
        isOnePiece: false,
        isComplete: false,
        missingItemRoles: [] as DrawerRole[],
        inLaundryRoles: [] as DrawerRole[],
      };
    }

    const checkPiece = (id?: number) => {
      if (!id) return { item: undefined, missing: false, inWash: false };
      const item = itemsById.get(id);
      if (!item) return { item: undefined, missing: true, inWash: false };
      const inWash =
        item.laundryStatus === "in_wash" ||
        (item as unknown as { inLaundry?: boolean }).inLaundry === true;
      return { item, missing: false, inWash };
    };

    const topState = checkPiece(slot.topId);
    const bottomState = checkPiece(slot.bottomId);
    const footwearState = checkPiece(slot.footwearId);
    const onePieceState = checkPiece(slot.onePieceId);
    const outerwearState = checkPiece(slot.outerwearId);

    const isOnePiece = Boolean(slot.onePieceId || onePieceState.item);

    const missingItemRoles: DrawerRole[] = [];
    const inLaundryRoles: DrawerRole[] = [];

    if (isOnePiece) {
      if (onePieceState.missing) missingItemRoles.push("one_piece");
      if (onePieceState.inWash) inLaundryRoles.push("one_piece");
      if (footwearState.missing) missingItemRoles.push("shoes");
      if (footwearState.inWash) inLaundryRoles.push("shoes");
    } else {
      if (topState.missing) missingItemRoles.push("tops");
      if (topState.inWash) inLaundryRoles.push("tops");
      if (bottomState.missing) missingItemRoles.push("bottoms");
      if (bottomState.inWash) inLaundryRoles.push("bottoms");
      if (footwearState.missing) missingItemRoles.push("shoes");
      if (footwearState.inWash) inLaundryRoles.push("shoes");
    }

    const isComplete = isOnePiece
      ? Boolean(onePieceState.item && footwearState.item)
      : Boolean(topState.item && bottomState.item && footwearState.item);

    return {
      top: topState.item,
      bottom: bottomState.item,
      footwear: footwearState.item,
      onePiece: onePieceState.item,
      outerwear: outerwearState.item,
      rawTopId: slot.topId,
      rawBottomId: slot.bottomId,
      rawFootwearId: slot.footwearId,
      rawOnePieceId: slot.onePieceId,
      rawOuterwearId: slot.outerwearId,
      isOnePiece,
      isComplete,
      missingItemRoles,
      inLaundryRoles,
    };
  }, [itemsById]);

  const campusState = useMemo(() => resolveSlotState(campusSlot), [campusSlot, resolveSlotState]);
  const gymState = useMemo(() => resolveSlotState(gymSlot), [gymSlot, resolveSlotState]);

  // Status for 7-day strip
  const plannedMapByDay = useMemo(() => {
    const map = new Map<
      DayOfWeek,
      { isRest: boolean; occasion: string; campusComplete: boolean; gymComplete: boolean }
    >();

    WEEK_DAYS.forEach((d) => {
      map.set(d.day, {
        isRest: false,
        occasion: ["Sat", "Sun"].includes(d.day) ? "casual" : "college",
        campusComplete: false,
        gymComplete: false,
      });
    });

    (livePlannedSlots ?? []).forEach((slot) => {
      const entry = map.get(slot.day);
      if (entry) {
        if (slot.occasion) entry.occasion = slot.occasion;
        if (slot.isRestDay) entry.isRest = true;
        const res = resolveSlotState(slot);
        if (slot.track === "campus") entry.campusComplete = res.isComplete;
        if (slot.track === "gym") entry.gymComplete = res.isComplete;
      }
    });
    return map;
  }, [livePlannedSlots, resolveSlotState]);

  // Open drawer specifically for a slot role
  const handleOpenRoleSelector = (track: TrackType, role: DrawerRole) => {
    setActiveSlotTrack(track);
    setActiveSlotRole(role);
    setDrawerOpen(true);
  };

  // Change occasion for selected day
  const handleChangeOccasion = async (occasion: OutfitOccasion) => {
    try {
      await setDayOccasion(selectedDay, "campus", occasion);
      setToastMessage(`Occasion set to ${occasion.toUpperCase()} for ${currentDayConfig.fullLabel}.`);
      setTimeout(() => setToastMessage(null), 2000);
    } catch (err) {
      console.error("Failed to change occasion:", err);
    }
  };

  // Toggle Rest Day status
  const handleToggleRestDay = async () => {
    try {
      const nextRest = !isRestDay;
      await setDayOccasion(selectedDay, "campus", nextRest ? "rest" : currentOccasion);
      setToastMessage(
        nextRest
          ? `${currentDayConfig.fullLabel} marked as Rest Day.`
          : `${currentDayConfig.fullLabel} set to active schedule.`
      );
      setTimeout(() => setToastMessage(null), 2000);
    } catch (err) {
      console.error("Failed to toggle rest day:", err);
    }
  };

  // Assign chosen piece into slot in Dexie (updates ONLY that piece)
  const handleSelectPiece = async (item: WardrobeItem) => {
    if (!item.id) return;
    try {
      await setPlanSlotPiece(selectedDay, activeSlotTrack, activeSlotRole as PlannerRole, item.id);
      setDrawerOpen(false);
      setToastMessage(
        `Added ${ROLE_LABELS[activeSlotRole].label} to ${activeSlotTrack === "campus" ? "Daily" : "Gym"} fit!`
      );
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.error("Failed to assign garment to plan slot:", err);
    }
  };

  // Clear a slot
  const handleClearSlot = async (track: TrackType) => {
    try {
      await clearPlanSlot(selectedDay, track);
      setToastMessage(
        `Cleared ${track === "campus" ? "Daily" : "Gym"} fit for ${currentDayConfig.fullLabel}.`
      );
      setTimeout(() => setToastMessage(null), 2000);
    } catch (err) {
      console.error("Failed to clear slot:", err);
    }
  };

  // Curate fit for ONLY the selected day without touching other days
  const handleCurateSingleDay = async () => {
    if (isCurating) return;
    setIsCurating(true);
    setCurateStageText(`Curating outfit for ${currentDayConfig.fullLabel} (${currentOccasion})...`);

    try {
      const cleanItems = cleanWardrobeItems;
      if (cleanItems.length === 0) {
        setToastMessage("No clean items in wardrobe to curate fits.");
        setIsCurating(false);
        return;
      }

      // Dynamic Weather (null if denied)
      let dynamicWeather: WeatherData | null = liveWeather;
      if (!dynamicWeather) {
        try {
          dynamicWeather = await getLiveWeather();
          setLiveWeather(dynamicWeather);
        } catch {
          // Weather stays null gracefully
        }
      }

      const recommendation = generateDeterministicOutfit({
        inventory: cleanItems,
        occasion: currentOccasion,
        weather: dynamicWeather,
        preferAlternativeStructures: true,
      });

      if (!recommendation.success || !recommendation.outfit) {
        setToastMessage(`Cannot curate: ${recommendation.error || "No valid combinations"}`);
        setIsCurating(false);
        return;
      }

      const fit = recommendation.outfit;
      await setFullPlanOutfit(
        selectedDay,
        "campus",
        fit.top?.id,
        fit.bottom?.id,
        fit.footwear?.id,
        fit.harmonyScore,
        fit.reasoning,
        {
          onePieceId: fit.onePiece?.id,
          outerwearId: fit.outerwear?.id,
          occasion: currentOccasion,
          isRestDay: false,
        }
      );

      setToastMessage(
        `✨ Curated ${fit.structure === "one_piece" ? "one-piece" : fit.isPartial ? "2-piece partial" : "3-piece"} fit for ${currentDayConfig.fullLabel}!`
      );
    } catch (err) {
      console.error("Single-day curation failed:", err);
      setToastMessage("Curation failed. Please try again.");
    } finally {
      setIsCurating(false);
      setCurateStageText("");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Auto-Curate Entire Week
  const handleAutoCurateWeek = async () => {
    if (isCurating) return;
    setIsCurating(true);
    setCurateStageText("Querying dynamic weather & scheduling entire week...");

    try {
      const cleanItems = cleanWardrobeItems;
      if (cleanItems.length === 0) {
        setToastMessage("No clean items in wardrobe to curate fits.");
        setIsCurating(false);
        return;
      }

      let dynamicWeather: WeatherData | null = liveWeather;
      if (!dynamicWeather) {
        try {
          dynamicWeather = await getLiveWeather();
          setLiveWeather(dynamicWeather);
        } catch {
          // Graceful null
        }
      }

      const allDays: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      let curatedCount = 0;

      for (const day of allDays) {
        const slot = (livePlannedSlots ?? []).find((s) => s.day === day && s.track === "campus");
        // Skip days configured as rest days
        if (slot?.isRestDay) continue;

        const dayOccasion: OutfitOccasion = (slot?.occasion as OutfitOccasion) || (
          ["Sat", "Sun"].includes(day) ? "casual" : "college"
        );

        const rec = generateDeterministicOutfit({
          inventory: cleanItems,
          occasion: dayOccasion,
          weather: dynamicWeather,
          preferAlternativeStructures: true,
        });

        if (rec.success && rec.outfit) {
          await setFullPlanOutfit(
            day,
            "campus",
            rec.outfit.top?.id,
            rec.outfit.bottom?.id,
            rec.outfit.footwear?.id,
            rec.outfit.harmonyScore,
            rec.outfit.reasoning,
            {
              onePieceId: rec.outfit.onePiece?.id,
              outerwearId: rec.outfit.outerwear?.id,
              occasion: dayOccasion,
              isRestDay: false,
            }
          );
          curatedCount++;
        }
      }

      setToastMessage(`✨ Curated ${curatedCount} days matching your daily preferences!`);
    } catch (err) {
      console.error("Auto-curate week failed:", err);
      setToastMessage("Week curation failed.");
    } finally {
      setIsCurating(false);
      setCurateStageText("");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Drawer items
  const drawerItems = useMemo(() => {
    let pool = cleanWardrobeItems;

    if (activeSlotRole === "one_piece") {
      pool = pool.filter((item) => {
        const cat = item.category.toLowerCase();
        return (
          cat === "one-piece" ||
          cat === "dresses" ||
          cat === "one_piece" ||
          cat === "dress"
        );
      });
    } else if (activeSlotRole === "shoes") {
      pool = pool.filter((item) => item.category.toLowerCase() === "shoes");
    } else if (activeSlotRole === "outerwear") {
      pool = pool.filter((item) => item.category.toLowerCase() === "outerwear");
    } else {
      pool = pool.filter((item) => item.category.toLowerCase() === activeSlotRole.toLowerCase());
    }

    if (activeSlotTrack === "gym") {
      pool = pool.filter((item) => {
        const tags = (item.tags || []).map((t) => t.toLowerCase());
        const sub = (item.subCategory || "").toLowerCase();
        return tags.includes("gym") || tags.includes("activewear") || sub.includes("athletic") || sub.includes("training");
      });
    }

    return pool;
  }, [cleanWardrobeItems, activeSlotRole, activeSlotTrack]);

  // Render a garment card or missing/in-wash card
  const renderPieceCard = (
    track: TrackType,
    role: DrawerRole,
    item?: WardrobeItem,
    rawId?: number,
    isMissing?: boolean,
    isInWash?: boolean
  ) => {
    const roleMeta = ROLE_LABELS[role];

    // Case 1: Slot has a garment ID recorded, but the garment was DELETED from Dexie
    if (rawId && isMissing) {
      return (
        <div className="flex-1 flex flex-col justify-between p-2.5 rounded-2xl border border-amber-300 bg-amber-50/70 shadow-2xs">
          <div className="flex items-center gap-1.5 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
            <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
            <span>Item Deleted</span>
          </div>
          <p className="text-[10px] text-amber-900 mt-1 leading-snug">
            Piece was removed from closet.
          </p>
          <button
            type="button"
            onClick={() => handleOpenRoleSelector(track, role)}
            className="mt-2 w-full py-1 text-[10px] font-semibold rounded-lg bg-amber-200/80 text-amber-900 hover:bg-amber-300 transition-colors"
          >
            Replace Item
          </button>
        </div>
      );
    }

    // Case 2: Slot has no item assigned yet
    if (!item) {
      return (
        <button
          type="button"
          onClick={() => handleOpenRoleSelector(track, role)}
          className="flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border border-dashed border-[#D8D4CC] bg-[#F9F8F6]/80 hover:bg-[#F2EFE9] hover:border-[#2D3A2F]/50 transition-all group min-h-[160px] text-center"
        >
          <div className="w-8 h-8 rounded-full bg-[#EFECE6] flex items-center justify-center text-[#8C887B] group-hover:text-[#2D3A2F] group-hover:bg-[#EBF2EC] transition-colors mb-2">
            <Plus size={16} strokeWidth={2.2} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C887B] group-hover:text-[#1A1A1A]">
            {roleMeta.label}
          </span>
          <span className="text-[11px] font-medium text-[#1A1A1A] mt-0.5">
            + Add {roleMeta.label}
          </span>
        </button>
      );
    }

    // Case 3: Item exists, but is currently IN LAUNDRY
    if (isInWash) {
      return (
        <div className="flex-1 flex flex-col bg-[#FFFFFF] rounded-2xl p-2 border border-slate-300 opacity-60 relative group">
          <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#F0EDE6] mb-1.5 grayscale">
            <Image
              src={item.imageUrl?.trim() ? item.imageUrl : getNeutralPlaceholder(item.category, item.color)}
              alt={item.name}
              fill
              unoptimized
              className="object-cover"
            />
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-slate-800 text-[8px] font-bold uppercase tracking-wider text-[#F9F8F6]">
              In Laundry
            </span>
            <button
              type="button"
              onClick={() => handleOpenRoleSelector(track, role)}
              className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-full bg-white/95 text-[9px] font-semibold text-[#1A1A1A] shadow-xs hover:bg-[#2D3A2F] hover:text-white"
            >
              Swap
            </button>
          </div>
          <h4 className="text-[11px] font-bold text-[#1A1A1A] tracking-tight truncate leading-snug line-through">
            {item.name}
          </h4>
          <span className="text-[9px] text-[#8C887B]">Currently in wash</span>
        </div>
      );
    }

    // Case 4: Standard clean item
    return (
      <div className="flex-1 flex flex-col bg-[#FFFFFF] rounded-2xl p-2 border border-[#EAE7E1] shadow-2xs group hover:border-[#2D3A2F]/30 transition-all">
        <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#F0EDE6] mb-1.5">
          <Image
            src={item.imageUrl?.trim() ? item.imageUrl : getNeutralPlaceholder(item.category, item.color)}
            alt={item.name}
            fill
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-[#1A1A1A]/80 backdrop-blur-md text-[8px] font-bold uppercase tracking-wider text-[#F9F8F6]">
            {roleMeta.label}
          </span>
          <button
            type="button"
            onClick={() => handleOpenRoleSelector(track, role)}
            className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-full bg-[#F9F8F6]/90 backdrop-blur-md text-[9px] font-semibold text-[#2D3A2F] shadow-xs hover:bg-[#2D3A2F] hover:text-[#F9F8F6] transition-colors"
          >
            Swap
          </button>
        </div>

        <h4 className="text-[11px] font-bold text-[#1A1A1A] tracking-tight truncate leading-snug">
          {item.name}
        </h4>

        <div className="flex items-center justify-between text-[9px] text-[#8C887B] mt-0.5">
          <span className="truncate">{item.brand || "Drippy"}</span>
          {item.color && (
            <span
              className="w-2 h-2 rounded-full border border-black/10 flex-shrink-0"
              style={{ backgroundColor: item.color }}
              title={item.color}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen text-[#1A1A1A] pb-28">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 bg-[#F9F8F6]/95 backdrop-blur-md px-5 pt-4 pb-2.5 border-b border-[#EAE7E1]/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="p-1.5 -ml-1.5 rounded-full text-[#1A1A1A] hover:bg-[#F0EDE6] transition-colors"
              aria-label="Back to wardrobe"
            >
              <ChevronLeft size={20} strokeWidth={2.2} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-semibold tracking-[0.24em] text-[#8C887B] uppercase block">
                  Weekly Planner
                </span>
                {liveWeather && (
                  <span className="text-[9px] font-semibold text-[#2D3A2F] bg-[#EBF2EC] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {liveWeather.summary}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[#1A1A1A] mt-0.5">
                Outfit Schedule
              </h1>
            </div>
          </div>

          {/* AI Auto-Curate Week Button */}
          <button
            type="button"
            onClick={handleAutoCurateWeek}
            disabled={isCurating}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all shadow-xs active:scale-95",
              isCurating
                ? "bg-[#2D3A2F]/80 text-[#F9F8F6] cursor-wait"
                : "bg-[#2D3A2F] text-[#F9F8F6] hover:bg-[#222c24] hover:shadow-md"
            )}
            title="Auto-curate all active days respecting each day's occasion"
          >
            {isCurating ? (
              <RotateCw size={13} className="animate-spin text-[#F9F8F6]" />
            ) : (
              <Sparkles size={13} className="text-amber-300" />
            )}
            <span>{isCurating ? "Curating..." : "Curate Week"}</span>
          </button>
        </div>

        {/* Minimal Horizontal 7-Day Strip (Mon-Sun) */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-4 select-none">
          {WEEK_DAYS.map((item) => {
            const isSelected = selectedDay === item.day;
            const status = plannedMapByDay.get(item.day);
            const isDayRest = status?.isRest;

            return (
              <button
                key={item.day}
                type="button"
                onClick={() => setSelectedDay(item.day)}
                className={cn(
                  "flex flex-col items-center justify-between py-2 px-1 rounded-2xl transition-all duration-200 active:scale-95 group",
                  isSelected
                    ? "bg-[#2D3A2F] text-[#F9F8F6] shadow-sm font-semibold"
                    : isDayRest
                    ? "bg-[#F0EDE6]/60 text-[#8C887B] border border-dashed border-[#D8D4CC]"
                    : "bg-[#F0EDE6] text-[#8C887B] hover:text-[#1A1A1A] hover:bg-[#E8E4DA]"
                )}
              >
                <span className="text-[11px] font-bold tracking-wide">
                  {item.label}
                </span>

                {/* Occasion / Rest label */}
                <span
                  className={cn(
                    "text-[8px] uppercase tracking-wider mt-0.5 truncate max-w-full px-0.5",
                    isSelected
                      ? "text-white/80"
                      : isDayRest
                      ? "text-[#8C887B]/70 italic"
                      : "text-[#8C887B]"
                  )}
                >
                  {isDayRest ? "Rest" : status?.occasion || "College"}
                </span>

                {/* Outfit Completion Indicator */}
                <div className="flex items-center gap-0.5 mt-1.5 h-1.5">
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all",
                      status?.campusComplete
                        ? isSelected
                          ? "bg-white"
                          : "bg-[#1A1A1A]"
                        : "opacity-0"
                    )}
                    title="Daily fit complete"
                  />
                  {status?.gymComplete && (
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all",
                        isSelected ? "bg-emerald-300" : "bg-[#2D3A2F]"
                      )}
                      title="Secondary fit complete"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-5 pt-4 flex flex-col gap-4">
        {/* Active Day Banner & Occasion Controls */}
        <div className="bg-[#FFFFFF] rounded-3xl p-4 border border-[#EAE7E1] shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold tracking-widest text-[#8C887B] uppercase block">
                Scheduled Day
              </span>
              <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] mt-0.5">
                {currentDayConfig.fullLabel}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {/* Single Day Curate Button */}
              <button
                type="button"
                onClick={handleCurateSingleDay}
                disabled={isCurating || isRestDay}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all shadow-xs active:scale-95",
                  isRestDay
                    ? "opacity-50 cursor-not-allowed bg-[#EFECE6] text-[#8C887B]"
                    : "bg-[#2D3A2F] text-[#F9F8F6] hover:bg-[#222c24]"
                )}
                title="Curate an outfit specifically for this day"
              >
                <Sparkles size={12} className="text-amber-300" />
                <span>Curate Day</span>
              </button>

              {/* Rest Day Toggle Button */}
              <button
                type="button"
                onClick={handleToggleRestDay}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                  isRestDay
                    ? "bg-[#2D3A2F] text-[#F9F8F6] border-[#2D3A2F]"
                    : "bg-[#F9F8F6] text-[#8C887B] border-[#EAE7E1] hover:text-[#1A1A1A]"
                )}
              >
                {isRestDay ? "Resting" : "Rest Day"}
              </button>
            </div>
          </div>

          {/* Occasion Selection Pills */}
          {!isRestDay && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {OCCASION_OPTIONS.map((occ) => {
                const Icon = occ.icon;
                const isSelected = currentOccasion === occ.id;
                return (
                  <button
                    key={occ.id}
                    type="button"
                    onClick={() => handleChangeOccasion(occ.id)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 border",
                      isSelected
                        ? "bg-[#EBF2EC] text-[#2D3A2F] border-[#2D3A2F]/30 font-semibold"
                        : "bg-[#F9F8F6] text-[#8C887B] border-[#EAE7E1] hover:text-[#1A1A1A]"
                    )}
                  >
                    <Icon size={12} className={isSelected ? "text-[#2D3A2F]" : "text-[#8C887B]"} />
                    <span>{occ.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Curating Progress Alert Banner */}
        {isCurating && (
          <div className="bg-[#2D3A2F] text-[#F9F8F6] rounded-2xl p-3.5 flex items-center gap-3 animate-pulse">
            <Sparkles size={18} className="text-amber-300 flex-shrink-0 animate-spin" />
            <div className="text-xs">
              <p className="font-bold">Drippy Outfit Engine Working...</p>
              <p className="text-[11px] text-white/80">{curateStageText}</p>
            </div>
          </div>
        )}

        {/* REST DAY DISPLAY */}
        {isRestDay ? (
          <section className="bg-[#F9F8F6] rounded-3xl p-8 border border-dashed border-[#D8D4CC] flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#EFECE6] flex items-center justify-center text-[#2D3A2F]">
              <Moon size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1A1A1A]">
                Rest & Recovery Day
              </h3>
              <p className="text-xs text-[#8C887B] mt-1 max-w-xs">
                No formal outfits or gym workouts scheduled for {currentDayConfig.fullLabel}. Dress comfortably!
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleRestDay}
              className="mt-2 px-4 py-2 rounded-full bg-[#2D3A2F] text-[#F9F8F6] text-xs font-semibold hover:bg-[#222c24] transition-all"
            >
              Plan Outfits for {currentDayConfig.fullLabel}
            </button>
          </section>
        ) : (
          <>
            {/* ===================== SLOT 1: PRIMARY / OCCASION FIT ===================== */}
            <section className="bg-[#FFFFFF] rounded-3xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-[#EAE7E1] flex flex-col gap-3.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#F0EDE6] flex items-center justify-center text-[#1A1A1A]">
                    <Shirt size={16} strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#1A1A1A] tracking-tight capitalize">
                        {currentOccasion} Fit
                      </h3>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase flex items-center gap-1",
                          campusState.isComplete
                            ? "bg-[#EBF2EC] text-[#2D3A2F]"
                            : "bg-[#F0EDE6] text-[#8C887B]"
                        )}
                      >
                        {campusState.isComplete ? (
                          <>
                            <Check size={10} strokeWidth={3} /> Complete
                          </>
                        ) : (
                          "Incomplete"
                        )}
                      </span>
                      {campusState.isOnePiece && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#1A1A1A] text-white text-[8px] font-bold uppercase tracking-wider">
                          One-Piece
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#8C887B]">
                      {campusState.isOnePiece
                        ? "Curated One-Piece dress and footwear"
                        : "3-piece combination: [Top, Bottom, Footwear]"}
                    </p>
                  </div>
                </div>

                {(campusState.top || campusState.bottom || campusState.footwear || campusState.onePiece) && (
                  <button
                    type="button"
                    onClick={() => handleClearSlot("campus")}
                    className="p-1.5 text-[#8C887B] hover:text-[#9E2A1E] rounded-full hover:bg-[#F0EDE6] transition-colors"
                    title="Clear Fit"
                    aria-label="Clear Fit"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Outfit Pieces Grid */}
              {campusState.isOnePiece ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {renderPieceCard(
                    "campus",
                    "one_piece",
                    campusState.onePiece,
                    campusState.rawOnePieceId,
                    campusState.missingItemRoles.includes("one_piece"),
                    campusState.inLaundryRoles.includes("one_piece")
                  )}
                  {renderPieceCard(
                    "campus",
                    "shoes",
                    campusState.footwear,
                    campusState.rawFootwearId,
                    campusState.missingItemRoles.includes("shoes"),
                    campusState.inLaundryRoles.includes("shoes")
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {renderPieceCard(
                    "campus",
                    "tops",
                    campusState.top,
                    campusState.rawTopId,
                    campusState.missingItemRoles.includes("tops"),
                    campusState.inLaundryRoles.includes("tops")
                  )}
                  {renderPieceCard(
                    "campus",
                    "bottoms",
                    campusState.bottom,
                    campusState.rawBottomId,
                    campusState.missingItemRoles.includes("bottoms"),
                    campusState.inLaundryRoles.includes("bottoms")
                  )}
                  {renderPieceCard(
                    "campus",
                    "shoes",
                    campusState.footwear,
                    campusState.rawFootwearId,
                    campusState.missingItemRoles.includes("shoes"),
                    campusState.inLaundryRoles.includes("shoes")
                  )}
                </div>
              )}

              {/* Switch to One-Piece / Standard toggle option */}
              <div className="flex items-center justify-end text-[10px] text-[#8C887B] gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleOpenRoleSelector("campus", campusState.isOnePiece ? "tops" : "one_piece")}
                  className="hover:text-[#2D3A2F] underline underline-offset-2"
                >
                  {campusState.isOnePiece ? "Switch to Top + Bottom" : "Switch to One-Piece Dress"}
                </button>
              </div>

              {/* AI Styling Reasoning / Harmony Score */}
              {campusSlot?.reasoning && (
                <div className="rounded-2xl bg-[#F9F8F6] p-3 border border-[#EAE7E1] text-[11px] flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[#2D3A2F] font-bold text-[10px] uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Sparkles size={11} className="text-amber-500" />
                      Styling Harmony
                    </span>
                    {campusSlot.harmonyScore && (
                      <span className="bg-[#EBF2EC] px-2 py-0.5 rounded-full">
                        {campusSlot.harmonyScore.toFixed(1)} / 10
                      </span>
                    )}
                  </div>
                  <p className="text-[#55524A] leading-relaxed">
                    {campusSlot.reasoning}
                  </p>
                </div>
              )}
            </section>

            {/* ===================== SLOT 2: OPTIONAL SECONDARY / GYM FIT ===================== */}
            <section className="bg-[#FFFFFF] rounded-3xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-[#EAE7E1] flex flex-col gap-3.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#EBF2EC] flex items-center justify-center text-[#2D3A2F]">
                    <Dumbbell size={16} strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#1A1A1A] tracking-tight">
                        Gym & Activewear Slot
                      </h3>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase flex items-center gap-1",
                          gymState.isComplete
                            ? "bg-[#EBF2EC] text-[#2D3A2F]"
                            : "bg-[#F0EDE6] text-[#8C887B]"
                        )}
                      >
                        {gymState.isComplete ? (
                          <>
                            <Check size={10} strokeWidth={3} /> Full Gear
                          </>
                        ) : (
                          "Optional"
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8C887B]">
                      Dedicated athletic wear for training sessions.
                    </p>
                  </div>
                </div>

                {(gymState.top || gymState.bottom || gymState.footwear) && (
                  <button
                    type="button"
                    onClick={() => handleClearSlot("gym")}
                    className="p-1.5 text-[#8C887B] hover:text-[#9E2A1E] rounded-full hover:bg-[#F0EDE6] transition-colors"
                    title="Clear Gym Fit"
                    aria-label="Clear Gym Fit"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Gym Pieces Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                {renderPieceCard(
                  "gym",
                  "tops",
                  gymState.top,
                  gymState.rawTopId,
                  gymState.missingItemRoles.includes("tops"),
                  gymState.inLaundryRoles.includes("tops")
                )}
                {renderPieceCard(
                  "gym",
                  "bottoms",
                  gymState.bottom,
                  gymState.rawBottomId,
                  gymState.missingItemRoles.includes("bottoms"),
                  gymState.inLaundryRoles.includes("bottoms")
                )}
                {renderPieceCard(
                  "gym",
                  "shoes",
                  gymState.footwear,
                  gymState.rawFootwearId,
                  gymState.missingItemRoles.includes("shoes"),
                  gymState.inLaundryRoles.includes("shoes")
                )}
              </div>

              {gymSlot?.reasoning && (
                <div className="rounded-2xl bg-[#F9F8F6] p-3 border border-[#EAE7E1] text-[11px] flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[#2D3A2F] font-bold text-[10px] uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={11} className="text-[#2D3A2F]" />
                      Activewear Logic
                    </span>
                    {gymSlot.harmonyScore && (
                      <span className="bg-[#EBF2EC] px-2 py-0.5 rounded-full">
                        {gymSlot.harmonyScore.toFixed(1)} / 10
                      </span>
                    )}
                  </div>
                  <p className="text-[#55524A] leading-relaxed">
                    {gymSlot.reasoning}
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        {/* Dynamic Weather & Style Status Banner */}
        <section className="bg-[#F0EDE6]/70 rounded-2xl p-3.5 flex items-center justify-between text-xs text-[#8C887B]">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[#2D3A2F]" />
            <span className="font-medium text-[#1A1A1A]">
              {liveWeather
                ? `${liveWeather.summary} • Temperature & Rain Adaptive`
                : "Pure Style Mode • Classical Tonal & Formality Balance"}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-[#2D3A2F]">
            {cleanWardrobeItems.length} Clean Pieces
          </span>
        </section>
      </main>

      {/* ===================== BOTTOM SELECTION DRAWER ===================== */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#F9F8F6] rounded-t-3xl border-t border-[#EAE7E1] shadow-2xl p-5 flex flex-col gap-4 max-h-[82vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300 pb-10">
            {/* Grab handle */}
            <div
              className="w-10 h-1 bg-[#D8D4CC] rounded-full mx-auto -mt-1 cursor-pointer"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#EAE7E1] pb-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B]">
                  {currentDayConfig.fullLabel} •{" "}
                  {activeSlotTrack === "campus" ? `${currentOccasion.toUpperCase()} Fit` : "Gym Fit"}
                </span>
                <h3 className="text-lg font-bold tracking-tight text-[#1A1A1A] mt-0.5">
                  Select {ROLE_LABELS[activeSlotRole].label}
                </h3>
                <p className="text-[11px] text-[#8C887B] mt-0.5">
                  {activeSlotTrack === "gym"
                    ? "Strictly Activewear & Gym items. Formal pieces excluded."
                    : "Clean garments only (in-laundry pieces excluded)."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-7 h-7 rounded-full bg-[#EFECE6] text-[#1A1A1A] flex items-center justify-center hover:bg-[#EAE7E1] transition-colors"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Role Switcher Tabs inside Drawer */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#EFECE6] rounded-2xl select-none">
              {(["tops", "bottoms", "shoes", "one_piece"] as DrawerRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setActiveSlotRole(role)}
                  className={cn(
                    "py-1.5 text-[11px] font-semibold rounded-xl transition-all text-center truncate px-1",
                    activeSlotRole === role
                      ? "bg-[#2D3A2F] text-[#F9F8F6] shadow-xs"
                      : "text-[#8C887B] hover:text-[#1A1A1A]"
                  )}
                >
                  {role === "one_piece" ? "Dress" : ROLE_LABELS[role].label}
                </button>
              ))}
            </div>

            {/* Clean Garment Grid */}
            {drawerItems.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-[#EFECE6] flex items-center justify-center text-[#8C887B] mb-2">
                  <Layers size={18} />
                </div>
                <p className="text-xs font-semibold text-[#1A1A1A]">
                  No matching clean pieces found
                </p>
                <p className="text-[11px] text-[#8C887B] mt-0.5 max-w-[260px]">
                  {activeSlotTrack === "gym"
                    ? "Ensure activewear items are tagged with 'Gym' or 'Activewear' and marked clean."
                    : "Add clean garments to your wardrobe or mark existing items as clean."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {drawerItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectPiece(item)}
                    className="flex flex-col p-2.5 rounded-2xl bg-[#FFFFFF] shadow-[0_2px_12px_rgba(0,0,0,0.02)] cursor-pointer transition-all hover:ring-1 hover:ring-[#2D3A2F] active:scale-95 group border border-[#EAE7E1]"
                  >
                    <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#F0EDE6] mb-2">
                      <Image
                        src={item.imageUrl?.trim() ? item.imageUrl : getNeutralPlaceholder(item.category, item.color)}
                        alt={item.name}
                        fill
                        unoptimized
                        sizes="(max-width: 448px) 50vw, 200px"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-[#F9F8F6]/90 backdrop-blur-md text-[8px] font-bold tracking-wider uppercase text-[#1A1A1A]">
                        {item.category}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-[#1A1A1A] tracking-tight truncate group-hover:text-[#2D3A2F] transition-colors leading-snug">
                      {item.name}
                    </h4>

                    <div className="flex items-center justify-between text-[10px] text-[#8C887B] mt-0.5">
                      <span className="truncate">{item.brand || "Drippy"}</span>
                      {item.color && (
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/10 flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Toast */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1A1A1A] text-[#F9F8F6] px-4 py-2.5 rounded-full text-xs font-medium tracking-wide flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check size={14} className="text-emerald-400" strokeWidth={3} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

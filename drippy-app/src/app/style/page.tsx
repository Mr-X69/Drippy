"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  Search,
  Bell,
  ChevronRight,
  GraduationCap,
  Footprints,
  Utensils,
  Briefcase,
  Sparkles,
  Bookmark,
  Check,
  X,
  Layers,
  RefreshCw,
  ShoppingBag,
  Camera,
  UploadCloud,
  User,
  Shirt,
  ArrowLeftRight,
  AlertCircle,
} from "lucide-react";
import {
  db,
  WardrobeItem,
  getAllWardrobeItems,
} from "@/lib/db";
import {
  generateDeterministicOutfit,
  type OutfitOccasion,
} from "@/lib/outfit-engine";
import { getNeutralPlaceholder } from "@/lib/placeholders";
import { getLiveWeather, type WeatherData } from "@/lib/weather";
import { cn } from "@/lib/utils";

// Occasion categories
type OccasionId = "college" | "casual" | "dinner" | "work";

interface OccasionOption {
  id: OccasionId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  vibe: string;
}

const OCCASIONS: OccasionOption[] = [
  { id: "college", label: "College", icon: GraduationCap, vibe: "Relaxed campus layers" },
  { id: "casual", label: "Casual", icon: Footprints, vibe: "Neutral daily essentials" },
  { id: "dinner", label: "Dinner", icon: Utensils, vibe: "Elevated evening mood" },
  { id: "work", label: "Work", icon: Briefcase, vibe: "Smart architectural tailoring" },
];

// Outfit slots
interface CoordinatePiece {
  slot: number;
  role: "Top" | "Bottoms" | "Footwear" | "Accessory";
  name: string;
  brand: string;
  imageUrl: string;
  color: string;
  inWardrobe: boolean;
}

// Preset base model poses for immediate VTON preview
const PRESET_MODELS = [
  {
    id: "model-studio",
    label: "Studio Neutral",
    imageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "model-stance",
    label: "Clean Stance",
    imageUrl:
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "model-street",
    label: "Street Tailored",
    imageUrl:
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80",
  },
];

// Helper to downscale uploaded images on the client before network transfer
const readFileAsScaledDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = document.createElement("img");
      img.onload = () => {
        const MAX_DIM = 1024;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function StyleLabPage() {
  const [viewMode, setViewMode] = useState<"flatlay" | "vton">("flatlay");
  const [selectedOccasion, setSelectedOccasion] = useState<OccasionId>("college");
  const [wardrobeList, setWardrobeList] = useState<WardrobeItem[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const [selectedAnchorId, setSelectedAnchorId] = useState<number | null>(null);

  // Read all clean items from Dexie live and fetch live weather
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const items = await getAllWardrobeItems(true);
        if (isMounted) {
          setWardrobeList(items);
        }
      } catch (err) {
        console.error("Failed to load wardrobe for styling lab:", err);
      }

      try {
        const liveWeather = await getLiveWeather();
        if (isMounted) {
          setWeather(liveWeather);
        }
      } catch (err) {
        console.warn("Live weather fetch failed:", err);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Active Anchor Item from real wardrobe (clean items only)
  const anchorItem = useMemo<WardrobeItem | null>(() => {
    if (wardrobeList.length === 0) return null;
    if (selectedAnchorId) {
      const found = wardrobeList.find((item) => item.id === selectedAnchorId);
      if (found) return found;
    }
    return wardrobeList[0];
  }, [wardrobeList, selectedAnchorId]);

  // Drawer states
  const [isStyleWithDrawerOpen, setIsStyleWithDrawerOpen] = useState(false);
  const [isGapDrawerOpen, setIsGapDrawerOpen] = useState(false);
  const [isSavedToastOpen, setIsSavedToastOpen] = useState(false);

  // VTON Base Photo & Garment Selection State
  const [selectedBasePhoto, setSelectedBasePhoto] = useState<string>(
    PRESET_MODELS[0].imageUrl
  );
  const [basePhotoLabel, setBasePhotoLabel] = useState<string>(PRESET_MODELS[0].label);
  const basePhotoInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedGarment, setSelectedGarment] = useState<{
    id?: number;
    name: string;
    category: string;
    imageUrl: string;
    color?: string;
  }>({
    name: "Clean Garment",
    category: "tops",
    imageUrl:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
    color: "#FFFFFF",
  });
  const garmentInputRef = React.useRef<HTMLInputElement>(null);
  const [isGarmentPickerOpen, setIsGarmentPickerOpen] = useState(false);
  const [garmentFilter, setGarmentFilter] = useState<string>("all");

  // VTON Execution & Output State
  const [isRenderingVTON, setIsRenderingVTON] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStageText, setRenderStageText] = useState("");
  const [vtonResultImage, setVtonResultImage] = useState<string | null>(null);
  const [vtonErrorMessage, setVtonErrorMessage] = useState<string | null>(null);
  const [showOriginalComparison, setShowOriginalComparison] = useState(false);
  const [vtonVersion, setVtonVersion] = useState<number>(1);

  // Real Outfit Recommendation generated deterministically from Dexie wardrobe
  const curatedResult = useMemo(() => {
    if (!anchorItem || wardrobeList.length === 0) return null;
    return generateDeterministicOutfit({
      inventory: wardrobeList,
      occasion: selectedOccasion as OutfitOccasion,
      requiredItemIds: anchorItem.id ? [anchorItem.id] : undefined,
      weather,
      preferAlternativeStructures: true,
    });
  }, [anchorItem, selectedOccasion, wardrobeList, weather]);

  // Coordinated look state derived from deterministic engine
  const currentLook = useMemo(() => {
    const outfit = curatedResult?.outfit;
    if (!outfit) {
      return {
        description:
          curatedResult?.error ||
          "Add more matching pieces to your closet to complete an outfit around this anchor garment.",
        score: 0,
        harmonyPct: 0,
        formalityText: selectedOccasion.toUpperCase(),
        pieces: [] as CoordinatePiece[],
        vtonImage: PRESET_MODELS[0].imageUrl,
        isComplete: false,
        isPartial: false,
        missingCategory: undefined as "footwear" | "bottoms" | "tops" | undefined,
        missingReason: undefined as "absent" | "in_laundry" | undefined,
        missingExplanation: undefined as string | undefined,
        error: curatedResult?.error,
        structure: "standard" as const,
        top: undefined as WardrobeItem | undefined,
        bottom: undefined as WardrobeItem | undefined,
        footwear: undefined as WardrobeItem | undefined,
        onePiece: undefined as WardrobeItem | undefined,
        outerwear: undefined as WardrobeItem | undefined,
      };
    }

    const pieces: CoordinatePiece[] = outfit.pieces.map((p, idx) => ({
      slot: idx + 1,
      role:
        p.role === "top"
          ? "Top"
          : p.role === "bottom"
          ? "Bottoms"
          : p.role === "footwear"
          ? "Footwear"
          : "Accessory",
      name: p.item.name,
      brand: p.item.brand || "Drippy Archive",
      imageUrl: p.item.imageUrl?.trim()
        ? p.item.imageUrl
        : getNeutralPlaceholder(p.item.category, p.item.color),
      color: p.item.color || "#1A1A1A",
      inWardrobe: true,
    }));

    return {
      description: outfit.reasoning,
      score: outfit.harmonyScore,
      harmonyPct: outfit.harmonyPercentage,
      formalityText: selectedOccasion.toUpperCase(),
      pieces,
      vtonImage: PRESET_MODELS[0].imageUrl,
      isComplete: true,
      isPartial: Boolean(outfit.isPartial),
      missingCategory: outfit.missingCategory,
      missingReason: outfit.missingReason,
      missingExplanation: outfit.missingExplanation,
      error: undefined,
      structure: outfit.structure,
      top: outfit.top,
      bottom: outfit.bottom,
      footwear: outfit.footwear,
      onePiece: outfit.onePiece,
      outerwear: outfit.outerwear,
    };
  }, [curatedResult, selectedOccasion]);

  // Handle Save Outfit to Dexie
  const handleSaveOutfit = async () => {
    if (!curatedResult?.outfit || !anchorItem) return;
    try {
      const ids = curatedResult.outfit.pieces
        .map((p) => p.item.id)
        .filter((id): id is number => typeof id === "number");

      await db.outfits.add({
        name: `${anchorItem.name} — ${selectedOccasion.toUpperCase()} Edit`,
        description: currentLook.description,
        itemIds: ids,
        tags: [selectedOccasion, "editorial", "curated"],
        season: ["all-season"],
        occasion: selectedOccasion,
        favorite: true,
        createdAt: Date.now(),
      });
      setIsSavedToastOpen(true);
      setTimeout(() => setIsSavedToastOpen(false), 3000);
    } catch (err) {
      console.error("Failed to save outfit to Dexie:", err);
    }
  };

  // Handle Base Photo Upload
  const handleBasePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const scaledDataUrl = await readFileAsScaledDataUrl(file);
      setSelectedBasePhoto(scaledDataUrl);
      setBasePhotoLabel("Your Photo");
      setVtonResultImage(null);
    } catch (err) {
      console.error("Failed to read base photo:", err);
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  // Handle Custom Garment Upload
  const handleGarmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const scaledDataUrl = await readFileAsScaledDataUrl(file);
      setSelectedGarment({
        name: file.name.replace(/\.[^/.]+$/, "") || "Custom Garment",
        category: "tops",
        imageUrl: scaledDataUrl,
        color: "#2D3A2F",
      });
      setIsGarmentPickerOpen(false);
      setVtonResultImage(null);
    } catch (err) {
      console.error("Failed to read garment photo:", err);
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  // Handle Real Virtual Try-On Generation via /api/vton (Hugging Face IDM-VTON)
  const handleGenerateVTON = async () => {
    if (isRenderingVTON) return;
    setIsRenderingVTON(true);
    setVtonErrorMessage(null);
    setShowOriginalComparison(false);
    setRenderProgress(10);
    setRenderStageText("Styling garment...");

    const stageInterval = setInterval(() => {
      setRenderProgress((prev) => {
        if (prev < 30) {
          setRenderStageText("Segmenting human pose & parsing cloth masks...");
          return prev + 6;
        }
        if (prev < 68) {
          setRenderStageText("Running Hugging Face IDM-VTON neural lane...");
          return prev + 5;
        }
        if (prev < 92) {
          setRenderStageText("Synthesizing realistic drapery & shadows...");
          return prev + 3;
        }
        return prev;
      });
    }, 700);

    try {
      const res = await fetch("/api/vton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseImage: selectedBasePhoto,
          garmentImage: selectedGarment.imageUrl,
          garmentDescription: `${selectedGarment.name} (${selectedGarment.category})`,
        }),
      });

      clearInterval(stageInterval);

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "IDM-VTON failed to synthesize drapery.");
      }

      setRenderProgress(100);
      setRenderStageText("Look synthesized successfully!");
      setVtonResultImage(data.outputUrl);
      setVtonVersion((prev) => prev + 1);
    } catch (err: unknown) {
      clearInterval(stageInterval);
      console.error("VTON generation failed:", err);
      const msg =
        err instanceof Error ? err.message : "Virtual Try-On service timed out.";
      setVtonErrorMessage(msg);
      // Fall back to editorial preview so the frame isn't blank
      if (!vtonResultImage) {
        setVtonResultImage(currentLook.vtonImage);
      }
    } finally {
      setIsRenderingVTON(false);
    }
  };

  // Save VTON outfit to Dexie
  const handleSaveVTONLook = async () => {
    try {
      const ids: number[] = selectedGarment.id
        ? [selectedGarment.id]
        : anchorItem?.id
        ? [anchorItem.id]
        : [];

      await db.outfits.add({
        name: `Virtual Try-On: ${selectedGarment.name}`,
        description: `Styling ${selectedGarment.name} on ${basePhotoLabel} with Hugging Face IDM-VTON`,
        itemIds: ids,
        tags: ["vton", "idm-vton", selectedGarment.category],
        season: ["all-season"],
        occasion: selectedOccasion,
        favorite: true,
        createdAt: Date.now(),
      });
      setIsSavedToastOpen(true);
      setTimeout(() => setIsSavedToastOpen(false), 3000);
    } catch (err) {
      console.error("Failed to save outfit to Dexie:", err);
    }
  };

  return (
    <div className="flex flex-col min-h-screen text-[#1A1A1A] pb-28">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#F9F8F6]/92 backdrop-blur-md border-b border-[#EAE7E1] px-5 pt-3.5 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="p-1.5 -ml-1.5 rounded-full text-[#1A1A1A] hover:bg-[#EAE7E1] transition-colors"
              aria-label="Back to wardrobe"
            >
              <ChevronLeft size={20} strokeWidth={2.2} />
            </Link>
            <span className="text-lg font-semibold tracking-wider uppercase text-[#1A1A1A]">
              Drippy
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="p-1.5 text-[#1A1A1A] hover:text-[#2D3A2F] transition-colors"
              aria-label="Search"
            >
              <Search size={18} strokeWidth={2} />
            </button>
            <div className="relative">
              <button
                className="p-1.5 text-[#1A1A1A] hover:text-[#2D3A2F] transition-colors"
                aria-label="Notifications"
              >
                <Bell size={18} strokeWidth={2} />
              </button>
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#2D3A2F]" />
            </div>
            <div className="w-7 h-7 rounded-full overflow-hidden border border-[#EAE7E1] bg-[#EFECE6] flex items-center justify-center">
              <Image
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
                alt="User Profile"
                width={28}
                height={28}
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Studio Area */}
      {wardrobeList.length === 0 ? (
        <main className="px-5 pt-16 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#EFECE6] flex items-center justify-center text-[#2D3A2F]">
            <Shirt size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A]">Your Wardrobe is Empty</h2>
            <p className="text-xs text-[#8C887B] mt-1 max-w-xs leading-relaxed">
              Add garments to your closet to center outfits around real pieces and see calculated harmony scores.
            </p>
          </div>
          <Link
            href="/"
            className="mt-2 px-5 py-2.5 rounded-full bg-[#2D3A2F] text-[#F9F8F6] text-xs font-semibold hover:bg-[#222c24] transition-all shadow-xs"
          >
            Go to Closet to Add Garments
          </Link>
        </main>
      ) : (
        <main className="px-5 pt-4 flex flex-col gap-4">
          {/* Editorial Heading + Active Weather Pill */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A] leading-tight">
                Build around
                <br />
                your {anchorItem?.category?.toLowerCase() || "item"}
              </h1>
              <p className="text-xs text-[#8C887B] mt-1 font-normal tracking-wide">
                Create outfits from your wardrobe.
              </p>
            </div>

            {weather && (
              <div
                className="bg-[#EBF2EC] border border-[#2D3A2F]/15 rounded-2xl px-2.5 py-1.5 flex flex-col items-end shadow-2xs text-right max-w-[150px]"
                title={`Live weather: ${weather.summary}`}
              >
                <span className="text-[9px] font-bold text-[#2D3A2F] uppercase tracking-wider flex items-center gap-1 truncate">
                  📍 {weather.locationName ? weather.locationName.split(",")[0] : "Local"}
                </span>
                <span className="text-[10px] font-semibold text-[#1A1A1A]">
                  {Math.round(weather.temperature)}°C • {weather.condition}
                </span>
              </div>
            )}
          </div>

          {/* Active Base Anchor Item Indicator */}
          {anchorItem && (
            <section
              onClick={() => setIsStyleWithDrawerOpen(true)}
              role="button"
              tabIndex={0}
              className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl p-3.5 flex items-center justify-between shadow-xs hover:border-[#2D3A2F]/40 transition-all cursor-pointer group active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-14 rounded-xl overflow-hidden bg-[#EFECE6] border border-[#EAE7E1] relative flex-shrink-0">
                  <Image
                    src={anchorItem.imageUrl?.trim() ? anchorItem.imageUrl : getNeutralPlaceholder(anchorItem.category, anchorItem.color)}
                    alt={anchorItem.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-[#8C887B]">
                    Your Item
                  </span>
                  <h2 className="text-sm font-semibold text-[#1A1A1A] group-hover:text-[#2D3A2F] transition-colors mt-0.5">
                    {anchorItem.name}
                  </h2>
                  <span className="text-[11px] text-[#8C887B] capitalize">{anchorItem.category}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[#8C887B] group-hover:text-[#2D3A2F] transition-colors">
                <span className="text-[11px] font-medium hidden sm:inline">Swap</span>
                <ChevronRight size={17} strokeWidth={2} />
              </div>
            </section>
          )}

          {/* Occasion Filter Pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
            {OCCASIONS.map((occ) => {
              const Icon = occ.icon;
              const isSelected = selectedOccasion === occ.id;
              return (
                <button
                  key={occ.id}
                  onClick={() => setSelectedOccasion(occ.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium tracking-wide transition-all duration-200 select-none whitespace-nowrap active:scale-95 border",
                    isSelected
                      ? "bg-[#EAECE6] text-[#2D3A2F] border-[#2D3A2F]/30 shadow-xs font-semibold"
                      : "bg-[#FFFFFF] text-[#8C887B] border-[#EAE7E1] hover:text-[#1A1A1A]"
                  )}
                >
                  <Icon size={14} className={isSelected ? "text-[#2D3A2F]" : "text-[#8C887B]"} />
                  <span>{occ.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sleek Segmented Toggle: [ Flat-Lay Canvas ] | [ Virtual Try-On ] */}
          <div className="bg-[#EFECE6] p-1 rounded-2xl flex border border-[#EAE7E1]/80 select-none">
            <button
              onClick={() => setViewMode("flatlay")}
              className={cn(
                "flex-1 py-2 text-xs font-medium tracking-wide rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5",
                viewMode === "flatlay"
                  ? "bg-[#2D3A2F] text-[#F9F8F6] shadow-sm font-semibold"
                  : "text-[#8C887B] hover:text-[#1A1A1A]"
              )}
            >
              <Layers size={14} />
              <span>Flat-Lay Canvas</span>
            </button>

            <button
              onClick={() => setViewMode("vton")}
              className={cn(
                "flex-1 py-2 text-xs font-medium tracking-wide rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5",
                viewMode === "vton"
                  ? "bg-[#2D3A2F] text-[#F9F8F6] shadow-sm font-semibold"
                  : "text-[#8C887B] hover:text-[#1A1A1A]"
              )}
            >
              <Sparkles size={14} />
              <span>Virtual Try-On</span>
            </button>
          </div>

          {/* ===================== VIEW 1: FLAT-LAY CANVAS ===================== */}
          {viewMode === "flatlay" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-200">
              {/* Meta Row: Pieces summary + Status Badge + Compatibility Score Pill */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-[#1A1A1A]">
                      {currentLook.pieces.length} pieces • all from your wardrobe
                    </p>
                    {currentLook.isComplete && !currentLook.isPartial && (
                      <span className="px-2 py-0.5 rounded-full bg-[#EBF2EC] text-[#2D3A2F] text-[9px] font-bold uppercase tracking-wider">
                        Complete Outfit
                      </span>
                    )}
                    {currentLook.isPartial && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FFF5E6] text-[#B26B1E] border border-[#B26B1E]/20 text-[9px] font-bold uppercase tracking-wider">
                        Partial Outfit
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#8C887B] mt-0.5 max-w-[280px] leading-snug">
                    {currentLook.description}
                  </p>
                </div>

                {/* Compatibility Score Indicator */}
                {currentLook.isComplete && (
                  <div
                    className="bg-[#EBF2EC] border border-[#2D3A2F]/20 rounded-xl px-2.5 py-1.5 flex flex-col items-center shadow-xs cursor-default"
                    title={`Color Harmony: ${currentLook.harmonyPct}% • Formality: ${currentLook.formalityText}`}
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[#2D3A2F]">
                      Outfit score
                    </span>
                    <span className="text-xs font-bold text-[#2D3A2F]">
                      {currentLook.score.toFixed(1)}
                      <span className="text-[10px] font-normal text-[#2D3A2F]/70">/10</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Informative Partial Outfit Notice Banner */}
              {currentLook.isPartial && currentLook.missingExplanation && (
                <div className="bg-[#FFF9F2] border border-[#F2C99D]/60 rounded-2xl p-2.5 flex items-center justify-between text-xs text-[#8C581E] shadow-2xs">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} className="text-[#B26B1E] flex-shrink-0" />
                    <span className="text-[11px] font-medium">{currentLook.missingExplanation}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGapDrawerOpen(true)}
                    className="text-[10px] font-semibold text-[#8C581E] underline hover:text-[#5E380F] flex-shrink-0"
                  >
                    Find footwear →
                  </button>
                </div>
              )}

              {/* Flat-Lay Editorial Visual Canvas */}
              {!currentLook.isComplete ? (
                <div className="relative rounded-3xl bg-[#F2EFE9] border border-[#EAE7E1] p-6 min-h-[300px] flex flex-col items-center justify-center text-center overflow-hidden shadow-xs gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#EAE7E1] flex items-center justify-center text-[#8C887B]">
                    <AlertCircle size={22} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1A1A1A]">
                      Incomplete Outfit Match
                    </h3>
                    <p className="text-xs text-[#8C887B] mt-1 max-w-xs leading-relaxed">
                      {currentLook.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStyleWithDrawerOpen(true)}
                    className="mt-1 px-4 py-1.5 rounded-full bg-[#2D3A2F] text-[#F9F8F6] text-xs font-medium hover:bg-[#222c24] transition-colors"
                  >
                    Style With Another Item
                  </button>
                </div>
              ) : (
                <div className="relative rounded-3xl bg-[#F2EFE9] border border-[#EAE7E1] p-4 min-h-[300px] flex items-center justify-center overflow-hidden shadow-xs">
                  {/* Subtle background grid pattern */}
                  <div
                    className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{
                      backgroundImage:
                        "radial-gradient(#1A1A1A 1px, transparent 1px)",
                      backgroundSize: "16px 16px",
                    }}
                  />

                  {/* Flat-Lay Layered Canvas */}
                  <div className="relative w-full max-w-[360px] h-[370px] flex items-center justify-center select-none py-2">
                    {currentLook.structure === "one_piece" ? (
                      <>
                        {/* 1. ONE-PIECE DRESS (Foundation Layer - z-10) */}
                        {currentLook.onePiece && (
                          <div
                            className="absolute top-6 left-1/2 -translate-x-1/2 w-[200px] h-[280px] z-10 transition-transform duration-300 hover:scale-105 hover:z-40 group cursor-pointer"
                            title={`${currentLook.onePiece.name} (One-Piece)`}
                          >
                            <div className="relative w-full h-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.16)] -rotate-1">
                              <Image
                                src={currentLook.onePiece.imageUrl?.trim() ? currentLook.onePiece.imageUrl : getNeutralPlaceholder(currentLook.onePiece.category, currentLook.onePiece.color)}
                                alt={currentLook.onePiece.name}
                                fill
                                unoptimized
                                className="object-contain"
                              />
                            </div>
                          </div>
                        )}

                        {/* 2. FOOTWEAR (Layer 2 - z-30) */}
                        {currentLook.footwear ? (
                          <div
                            className="absolute bottom-1 right-5 sm:right-8 w-[135px] h-[120px] z-30 transition-transform duration-300 hover:scale-105 hover:z-40 group cursor-pointer"
                            title={`${currentLook.footwear.name} (Footwear)`}
                          >
                            <div className="relative w-full h-full drop-shadow-[0_16px_32px_rgba(0,0,0,0.25)] -rotate-6">
                              <Image
                                src={currentLook.footwear.imageUrl?.trim() ? currentLook.footwear.imageUrl : getNeutralPlaceholder(currentLook.footwear.category, currentLook.footwear.color)}
                                alt={currentLook.footwear.name}
                                fill
                                unoptimized
                                className="object-contain"
                              />
                            </div>
                          </div>
                        ) : (
                          <div
                            className="absolute bottom-2 right-4 sm:right-7 w-[125px] h-[65px] z-30 rounded-2xl border-2 border-dashed border-[#8C887B]/40 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center -rotate-2"
                            title={currentLook.missingExplanation || "Footwear omitted"}
                          >
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#8C887B]">
                              Footwear
                            </span>
                            <span className="text-[8px] font-semibold text-[#B26B1E] mt-0.5">
                              {currentLook.missingReason === "in_laundry"
                                ? "All shoes in wash"
                                : "None in wardrobe"}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* 1. BOTTOMS (Foundation Layer - z-10) */}
                        {currentLook.bottom && (
                          <div
                            className="absolute top-12 left-1/2 -translate-x-1/2 w-[165px] h-[255px] z-10 transition-transform duration-300 hover:scale-105 hover:z-40 group cursor-pointer"
                            title={`${currentLook.bottom.name} (Bottoms)`}
                          >
                            <div className="relative w-full h-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.14)] -rotate-1">
                              <Image
                                src={currentLook.bottom.imageUrl?.trim() ? currentLook.bottom.imageUrl : getNeutralPlaceholder(currentLook.bottom.category, currentLook.bottom.color)}
                                alt={currentLook.bottom.name}
                                fill
                                unoptimized
                                className="object-contain"
                              />
                            </div>
                          </div>
                        )}

                        {/* 2. TOP (Layer 2 - z-20) */}
                        {currentLook.top && (
                          <div
                            className="absolute top-2 left-4 sm:left-6 w-[155px] h-[180px] z-20 transition-transform duration-300 hover:scale-105 hover:z-40 group cursor-pointer"
                            title={`${currentLook.top.name} (Top)`}
                          >
                            <div className="relative w-full h-full drop-shadow-[0_14px_28px_rgba(0,0,0,0.20)] rotate-2">
                              <Image
                                src={currentLook.top.imageUrl?.trim() ? currentLook.top.imageUrl : getNeutralPlaceholder(currentLook.top.category, currentLook.top.color)}
                                alt={currentLook.top.name}
                                fill
                                unoptimized
                                className="object-contain"
                              />
                            </div>
                          </div>
                        )}

                        {/* 3. ACCESSORY / OUTERWEAR (Layer 3 - z-25) */}
                        {(currentLook.outerwear || currentLook.pieces[2]?.role === "Accessory") && (
                          <div
                            className="absolute top-3 right-4 sm:right-6 w-[105px] h-[105px] z-25 transition-transform duration-300 hover:scale-105 hover:z-40 group cursor-pointer"
                            title="Extra Layer"
                          >
                            <div className="relative w-full h-full drop-shadow-[0_8px_18px_rgba(0,0,0,0.16)] rotate-6">
                              <Image
                                src={currentLook.outerwear?.imageUrl?.trim() ? currentLook.outerwear.imageUrl : currentLook.pieces[2]?.imageUrl || getNeutralPlaceholder("outerwear", "#1A1A1A")}
                                alt="Layer"
                                fill
                                unoptimized
                                className="object-contain"
                              />
                            </div>
                          </div>
                        )}

                        {/* 4. FOOTWEAR (Layer 4 - z-30) */}
                        {currentLook.footwear ? (
                          <div
                            className="absolute bottom-1 right-5 sm:right-8 w-[135px] h-[120px] z-30 transition-transform duration-300 hover:scale-105 hover:z-40 group cursor-pointer"
                            title={`${currentLook.footwear.name} (Footwear)`}
                          >
                            <div className="relative w-full h-full drop-shadow-[0_16px_32px_rgba(0,0,0,0.25)] -rotate-6">
                              <Image
                                src={currentLook.footwear.imageUrl?.trim() ? currentLook.footwear.imageUrl : getNeutralPlaceholder(currentLook.footwear.category, currentLook.footwear.color)}
                                alt={currentLook.footwear.name}
                                fill
                                unoptimized
                                className="object-contain"
                              />
                            </div>
                          </div>
                        ) : (
                          <div
                            className="absolute bottom-2 right-4 sm:right-7 w-[125px] h-[65px] z-30 rounded-2xl border-2 border-dashed border-[#8C887B]/40 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center -rotate-2"
                            title={currentLook.missingExplanation || "Footwear omitted"}
                          >
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#8C887B]">
                              Footwear
                            </span>
                            <span className="text-[8px] font-semibold text-[#B26B1E] mt-0.5">
                              {currentLook.missingReason === "in_laundry"
                                ? "All shoes in wash"
                                : "None in wardrobe"}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Real Detailed Inventory Row */}
              {currentLook.pieces.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {currentLook.pieces.map((piece) => (
                    <div
                      key={piece.slot}
                      className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl p-2 flex flex-col justify-between shadow-2xs hover:border-[#2D3A2F]/40 transition-colors"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#EFECE6] mb-1.5">
                        <Image
                          src={piece.imageUrl}
                          alt={piece.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-[#1A1A1A]/80 backdrop-blur-md text-[8px] font-bold uppercase tracking-wider text-[#F9F8F6]">
                          {piece.role}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <h4 className="text-[10px] font-semibold text-[#1A1A1A] truncate leading-tight">
                          {piece.name}
                        </h4>
                        <span className="text-[9px] text-[#8C887B] truncate">
                          {piece.brand}
                        </span>
                        <span className="flex items-center gap-0.5 text-[8px] font-medium text-[#2D3A2F] mt-1">
                          <Check size={10} strokeWidth={2.5} /> In wardrobe
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Primary Action Buttons Bar */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  onClick={handleSaveOutfit}
                  disabled={!currentLook.isComplete}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-full text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all shadow-sm",
                    currentLook.isComplete
                      ? "bg-[#1A1A1A] text-[#F9F8F6] hover:bg-black active:scale-95"
                      : "bg-[#EFECE6] text-[#8C887B] cursor-not-allowed"
                  )}
                >
                  <Bookmark size={15} />
                  <span>Save outfit</span>
                </button>

                <button
                  onClick={() => setIsGapDrawerOpen(true)}
                  className="flex-1 py-3 px-4 rounded-full bg-[#F0EEE6] border border-[#2D3A2F]/30 text-[#2D3A2F] text-xs font-semibold tracking-wide flex items-center justify-center gap-1.5 hover:bg-[#EAE7DC] active:scale-95 transition-all"
                >
                  <Sparkles size={14} />
                  <span>Find a missing piece →</span>
                </button>
              </div>
            </div>
          )}

        {/* ===================== VIEW 2: VIRTUAL TRY-ON (VTON) ===================== */}
        {viewMode === "vton" && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            {/* VTON Pipeline Status Bar */}
            <div className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl px-3.5 py-2.5 flex items-center justify-between text-xs shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D3A2F] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2D3A2F]"></span>
                </span>
                <span className="font-semibold text-[#1A1A1A] text-[11px]">
                  Hugging Face IDM-VTON Lane
                </span>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-[#8C887B]">
                <span className="px-2 py-0.5 rounded-full bg-[#EFECE6] font-medium text-[#2D3A2F]">
                  Gradio Client Active
                </span>
                <span>Neural Try-On</span>
              </div>
            </div>

            {/* TWO IMAGE SELECTION ZONES */}
            <div className="grid grid-cols-2 gap-3">
              {/* Zone 1: Select Base Photo (You) */}
              <div className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl p-3 flex flex-col justify-between shadow-2xs hover:border-[#2D3A2F]/30 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C887B] flex items-center gap-1">
                    <User size={12} className="text-[#2D3A2F]" />
                    Base Photo (You)
                  </span>
                  <span className="text-[9px] font-medium text-[#2D3A2F] bg-[#EBF2EC] px-1.5 py-0.5 rounded-full truncate max-w-[70px]">
                    {basePhotoLabel}
                  </span>
                </div>

                {/* Thumbnail Preview */}
                <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#EFECE6] border border-[#EAE7E1] mb-2 group">
                  <Image
                    src={selectedBasePhoto}
                    alt="Base Model"
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                    <button
                      type="button"
                      onClick={() => basePhotoInputRef.current?.click()}
                      className="px-2 py-1 rounded-full bg-white text-[#1A1A1A] text-[10px] font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <UploadCloud size={11} /> Upload
                    </button>
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="flex gap-1 mb-2">
                  {PRESET_MODELS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        setSelectedBasePhoto(model.imageUrl);
                        setBasePhotoLabel(model.label);
                        setVtonResultImage(null);
                      }}
                      className={cn(
                        "flex-1 py-1 rounded-lg text-[9px] font-medium transition-all text-center truncate",
                        selectedBasePhoto === model.imageUrl
                          ? "bg-[#2D3A2F] text-[#F9F8F6] font-semibold"
                          : "bg-[#F9F8F6] text-[#8C887B] hover:text-[#1A1A1A] border border-[#EAE7E1]"
                      )}
                    >
                      {model.label.split(" ")[0]}
                    </button>
                  ))}
                </div>

                {/* Upload Action */}
                <button
                  type="button"
                  onClick={() => basePhotoInputRef.current?.click()}
                  className="w-full py-1.5 px-2 rounded-xl bg-[#F0EEE6] text-[#2D3A2F] text-[10px] font-semibold flex items-center justify-center gap-1 hover:bg-[#EAE7DC] active:scale-95 transition-all"
                >
                  <Camera size={12} />
                  <span>Upload / Snap photo</span>
                </button>
                <input
                  type="file"
                  ref={basePhotoInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleBasePhotoUpload}
                />
              </div>

              {/* Zone 2: Select Garment (From Wardrobe) */}
              <div className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl p-3 flex flex-col justify-between shadow-2xs hover:border-[#2D3A2F]/30 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C887B] flex items-center gap-1">
                    <Shirt size={12} className="text-[#2D3A2F]" />
                    Garment
                  </span>
                  <span className="text-[9px] font-medium text-[#2D3A2F] bg-[#EBF2EC] px-1.5 py-0.5 rounded-full capitalize">
                    {selectedGarment.category}
                  </span>
                </div>

                {/* Thumbnail Preview */}
                <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#EFECE6] border border-[#EAE7E1] mb-2 group">
                  <Image
                    src={selectedGarment.imageUrl}
                    alt={selectedGarment.name}
                    fill
                    unoptimized
                    className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                    <button
                      type="button"
                      onClick={() => setIsGarmentPickerOpen(true)}
                      className="px-2 py-1 rounded-full bg-white text-[#1A1A1A] text-[10px] font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <Layers size={11} /> Wardrobe
                    </button>
                  </div>
                </div>

                <div className="mb-2">
                  <h4 className="text-[11px] font-semibold text-[#1A1A1A] truncate">
                    {selectedGarment.name}
                  </h4>
                  <span className="text-[9px] text-[#8C887B]">Ready to drape</span>
                </div>

                {/* Choose from Wardrobe Button */}
                <button
                  type="button"
                  onClick={() => setIsGarmentPickerOpen(true)}
                  className="w-full py-1.5 px-2 rounded-xl bg-[#2D3A2F]/10 text-[#2D3A2F] text-[10px] font-semibold flex items-center justify-center gap-1 hover:bg-[#2D3A2F]/15 active:scale-95 transition-all"
                >
                  <ShoppingBag size={12} />
                  <span>Choose from wardrobe</span>
                </button>
                <input
                  type="file"
                  ref={garmentInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleGarmentUpload}
                />
              </div>
            </div>

            {/* PRIMARY ACTION: GENERATE TRY-ON BUTTON */}
            <button
              onClick={handleGenerateVTON}
              disabled={isRenderingVTON}
              className={cn(
                "w-full py-3.5 px-6 rounded-full text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all shadow-md active:scale-98",
                isRenderingVTON
                  ? "bg-[#2D3A2F]/70 text-[#F9F8F6] cursor-wait"
                  : "bg-[#2D3A2F] text-[#F9F8F6] hover:bg-[#222c24]"
              )}
            >
              {isRenderingVTON ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Styling garment...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generate Try-On (Hugging Face IDM-VTON)</span>
                </>
              )}
            </button>

            {/* Error Banner */}
            {vtonErrorMessage && (
              <div className="bg-[#FFF4F2] border border-[#F2C0B7] rounded-2xl p-3 flex items-start gap-2.5 text-xs text-[#9E2A1E] animate-in fade-in">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Try-On Notice</p>
                  <p className="text-[11px] text-[#9E2A1E]/80 mt-0.5">{vtonErrorMessage}</p>
                </div>
              </div>
            )}

            {/* PROMINENT 3:4 PORTRAIT FRAME CANVAS */}
            <div className="relative aspect-[3/4] w-full rounded-3xl overflow-hidden bg-[#EFECE6] border border-[#EAE7E1] shadow-md group">
              <Image
                key={vtonVersion}
                src={
                  showOriginalComparison
                    ? selectedBasePhoto
                    : vtonResultImage || currentLook.vtonImage
                }
                alt="Virtual Try-On Result"
                fill
                priority
                unoptimized
                className={cn(
                  "object-cover transition-all duration-700",
                  isRenderingVTON ? "scale-105 blur-xs opacity-70" : "scale-100 blur-0 opacity-100"
                )}
              />

              {/* Gradient Bottom Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

              {/* Watermark / Pipeline badge */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#1A1A1A]/75 backdrop-blur-md text-[9px] font-mono tracking-wider uppercase text-[#F9F8F6] border border-white/20">
                {showOriginalComparison
                  ? "Original Base Photo"
                  : vtonResultImage
                  ? "IDM-VTON Synthesized"
                  : "Studio Preview"}
              </div>

              {/* Comparison Pill Toggle */}
              {vtonResultImage && (
                <button
                  type="button"
                  onClick={() => setShowOriginalComparison(!showOriginalComparison)}
                  className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-medium flex items-center gap-1.5 border border-white/25 hover:bg-black/80 transition-all"
                >
                  <ArrowLeftRight size={12} />
                  <span>{showOriginalComparison ? "Show Try-On" : "Compare"}</span>
                </button>
              )}

              {/* EDITORIAL LOADING STATE ("Styling garment...") */}
              {isRenderingVTON && (
                <div className="absolute inset-0 bg-black/65 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-white z-20 animate-in fade-in">
                  <div className="w-12 h-12 rounded-full border-2 border-[#2D3A2F] border-t-emerald-400 animate-spin mb-3.5 shadow-lg" />
                  <span className="text-xs font-semibold tracking-wider uppercase text-emerald-300">
                    Styling garment...
                  </span>
                  <p className="text-[11px] text-zinc-300 mt-1 max-w-[240px]">
                    {renderStageText}
                  </p>
                  <div className="w-48 bg-white/20 rounded-full h-1.5 mt-4 overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${renderProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 mt-1.5">
                    {renderProgress}%
                  </span>
                </div>
              )}

              {/* On-Canvas Bottom Metadata */}
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white z-10">
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-emerald-300 block">
                    {vtonResultImage ? "Synthesized Fit" : "Curated Drapery"}
                  </span>
                  <h3 className="text-sm font-semibold tracking-tight text-white">
                    {selectedGarment.name} on {basePhotoLabel}
                  </h3>
                  <span className="text-[10px] text-zinc-300">
                    Neural Diffusion • 3:4 Portrait Ratio
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleSaveVTONLook}
                    className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all border border-white/20"
                    title="Save Look to Outfits"
                  >
                    <Bookmark size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Post-Generation Action Bar */}
            {vtonResultImage && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOriginalComparison(!showOriginalComparison)}
                  className="flex-1 py-2.5 px-3 rounded-full bg-[#FFFFFF] border border-[#EAE7E1] text-[#1A1A1A] text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs hover:border-[#2D3A2F]/40 transition-colors"
                >
                  <ArrowLeftRight size={13} className="text-[#2D3A2F]" />
                  <span>{showOriginalComparison ? "View Try-On" : "Compare Original"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveVTONLook}
                  className="flex-1 py-2.5 px-3 rounded-full bg-[#1A1A1A] text-[#F9F8F6] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-black transition-all shadow-xs"
                >
                  <Bookmark size={13} />
                  <span>Save Look</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    )}

      {/* ===================== BOTTOM WARDROBE GAP DRAWER ===================== */}
      {/* Inspired directly by "Smart additions / Buy less. Wear more." */}
      {isGapDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#F9F8F6] rounded-t-3xl border-t border-[#EAE7E1] shadow-2xl p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300 pb-10">
            {/* Grab handle */}
            <div className="w-10 h-1 bg-[#D8D4CC] rounded-full mx-auto -mt-1 cursor-pointer" onClick={() => setIsGapDrawerOpen(false)} />

            {/* Header: Smart Additions */}
            <div className="flex items-start justify-between border-b border-[#EAE7E1] pb-3">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-[#1A1A1A]">
                  Smart additions
                </h3>
                <p className="text-xs text-[#8C887B] mt-0.5">Buy less. Wear more.</p>
              </div>

              <button
                onClick={() => setIsGapDrawerOpen(false)}
                className="w-7 h-7 rounded-full bg-[#EFECE6] text-[#1A1A1A] flex items-center justify-center hover:bg-[#EAE7E1] transition-colors"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Current Matching Item Pill */}
            {anchorItem && (
              <div className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-xl p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-10 rounded-lg overflow-hidden bg-[#EFECE6] relative flex-shrink-0">
                    <Image
                      src={anchorItem.imageUrl?.trim() ? anchorItem.imageUrl : getNeutralPlaceholder(anchorItem.category, anchorItem.color)}
                      alt={anchorItem.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[#8C887B] block">
                      Matching your item
                    </span>
                    <h4 className="text-xs font-semibold text-[#1A1A1A]">
                      {anchorItem.name}
                    </h4>
                  </div>
                </div>
                <ChevronRight size={15} className="text-[#8C887B]" />
              </div>
            )}

            {/* Hero Staple Gap Recommendation Card */}
            <div className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
              <div className="flex gap-4">
                <div className="relative w-28 aspect-[3/4] rounded-xl overflow-hidden bg-[#F2EFE9] border border-[#EAE7E1] flex-shrink-0">
                  <Image
                    src="https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=600&q=80"
                    alt="Cream knit polo"
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="flex flex-col justify-between flex-1">
                  <div>
                    <span className="px-2 py-0.5 rounded-full bg-[#EDF3EC] text-[#2D3A2F] text-[9px] font-bold tracking-wider uppercase border border-[#2D3A2F]/20">
                      High Versatility
                    </span>
                    <h4 className="text-sm font-bold text-[#1A1A1A] mt-1.5">
                      Cream knit polo
                    </h4>
                    <span className="text-sm font-semibold text-[#1A1A1A]">
                      ₹899
                    </span>
                  </div>

                  <p className="text-[11px] text-[#8C887B]">
                    Works with <span className="font-semibold text-[#1A1A1A]">4 items</span> you already own.
                  </p>
                </div>
              </div>

              {/* 4 Items Owned Pairing Thumbnails */}
              <div className="grid grid-cols-4 gap-2 pt-1 border-t border-[#EAE7E1]/70">
                {[
                  {
                    name: anchorItem?.name || "Anchor Item",
                    img: anchorItem?.imageUrl || "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=300&q=80",
                  },
                  {
                    name: "White tee",
                    img: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=300&q=80",
                  },
                  {
                    name: "White sneakers",
                    img: "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?auto=format&fit=crop&w=300&q=80",
                  },
                  {
                    name: "Forest trench",
                    img: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-lg overflow-hidden relative border border-[#EAE7E1] bg-[#EFECE6] mb-1">
                      <Image src={item.img} alt={item.name} fill className="object-cover" />
                    </div>
                    <span className="text-[8px] text-[#8C887B] truncate w-full">
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* "What it unlocks" section */}
            <div className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl p-4 flex flex-col gap-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1A1A1A] flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#2D3A2F]" />
                  What it unlocks
                </span>
                <span className="text-[10px] font-semibold text-[#2D3A2F] bg-[#EDF3EC] px-2 py-0.5 rounded-full">
                  +3 outfit combinations
                </span>
              </div>

              {/* 3 mini look preview cards */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  {
                    title: "Casual College",
                    img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80",
                  },
                  {
                    title: "Everyday Fit",
                    img: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=400&q=80",
                  },
                  {
                    title: "Minimal & Clean",
                    img: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
                  },
                ].map((look, i) => (
                  <div
                    key={i}
                    className="flex flex-col rounded-xl overflow-hidden border border-[#EAE7E1] bg-[#F9F8F6] group cursor-pointer hover:border-[#2D3A2F]/40"
                  >
                    <div className="relative aspect-[3/4] w-full">
                      <Image src={look.img} alt={look.title} fill className="object-cover" />
                    </div>
                    <span className="p-1.5 text-[9px] font-medium text-[#1A1A1A] truncate group-hover:text-[#2D3A2F]">
                      {look.title} &gt;
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Other useful additions */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-[#8C887B] uppercase tracking-wider">
                Other useful additions
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-xl p-2.5 flex items-center justify-between">
                  <div>
                    <h5 className="text-[11px] font-semibold text-[#1A1A1A]">
                      Black leather belt
                    </h5>
                    <span className="text-[10px] text-[#8C887B]">₹399</span>
                  </div>
                  <ChevronRight size={14} className="text-[#8C887B]" />
                </div>

                <div className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-xl p-2.5 flex items-center justify-between">
                  <div>
                    <h5 className="text-[11px] font-semibold text-[#1A1A1A]">
                      Light overshirt
                    </h5>
                    <span className="text-[10px] text-[#8C887B]">₹1,199</span>
                  </div>
                  <ChevronRight size={14} className="text-[#8C887B]" />
                </div>
              </div>
            </div>

            {/* Bottom CTA action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setIsGapDrawerOpen(false)}
                className="flex-1 py-3 rounded-full bg-[#1A1A1A] text-[#F9F8F6] text-xs font-semibold tracking-wide flex items-center justify-center gap-1.5 hover:bg-black active:scale-95 transition-all shadow-sm"
              >
                <ShoppingBag size={14} />
                <span>Explore item</span>
              </button>

              <button
                onClick={() => setIsGapDrawerOpen(false)}
                className="px-5 py-3 rounded-full border border-[#EAE7E1] text-[#8C887B] text-xs font-medium hover:text-[#1A1A1A] transition-colors"
              >
                Not for me
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== "STYLE WITH ANOTHER ITEM" DRAWER ===================== */}
      {isStyleWithDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#F9F8F6] rounded-t-3xl border-t border-[#EAE7E1] shadow-2xl p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300 pb-10">
            <div className="w-10 h-1 bg-[#D8D4CC] rounded-full mx-auto -mt-1 cursor-pointer" onClick={() => setIsStyleWithDrawerOpen(false)} />

            <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B]">
                  Anchor Piece
                </span>
                <h3 className="text-lg font-bold tracking-tight text-[#1A1A1A]">
                  Style with another item
                </h3>
              </div>
              <button
                onClick={() => setIsStyleWithDrawerOpen(false)}
                className="w-7 h-7 rounded-full bg-[#EFECE6] text-[#1A1A1A] flex items-center justify-center hover:bg-[#EAE7E1] transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-[#8C887B]">
              Choose any piece from your wardrobe to center your outfit curation.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {wardrobeList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.id) setSelectedAnchorId(item.id);
                    setIsStyleWithDrawerOpen(false);
                  }}
                  className={cn(
                    "flex flex-col p-2 rounded-2xl border bg-[#FFFFFF] cursor-pointer transition-all hover:border-[#2D3A2F] active:scale-95 group",
                    anchorItem?.id === item.id
                      ? "border-[#2D3A2F] ring-1 ring-[#2D3A2F]"
                      : "border-[#EAE7E1]"
                  )}
                >
                  <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#EFECE6] mb-1.5">
                    <Image
                      src={item.imageUrl?.trim() ? item.imageUrl : getNeutralPlaceholder(item.category, item.color)}
                      alt={item.name}
                      fill
                      unoptimized
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {anchorItem?.id === item.id && (
                      <span className="absolute top-1.5 right-1.5 bg-[#2D3A2F] text-white p-1 rounded-full shadow-xs">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-semibold text-[#1A1A1A] truncate group-hover:text-[#2D3A2F]">
                    {item.name}
                  </h4>
                  <span className="text-[10px] text-[#8C887B] capitalize">
                    {item.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== WARDROBE GARMENT PICKER DRAWER ===================== */}
      {isGarmentPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#F9F8F6] rounded-t-3xl border-t border-[#EAE7E1] shadow-2xl p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300 pb-10">
            <div
              className="w-10 h-1 bg-[#D8D4CC] rounded-full mx-auto -mt-1 cursor-pointer"
              onClick={() => setIsGarmentPickerOpen(false)}
            />

            <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B]">
                  Virtual Try-On Target
                </span>
                <h3 className="text-lg font-bold tracking-tight text-[#1A1A1A]">
                  Select Garment to Try On
                </h3>
              </div>
              <button
                onClick={() => setIsGarmentPickerOpen(false)}
                className="w-7 h-7 rounded-full bg-[#EFECE6] text-[#1A1A1A] flex items-center justify-center hover:bg-[#EAE7E1] transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Category Filter Chips */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {(["all", "tops", "bottoms", "outerwear"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setGarmentFilter(cat)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium capitalize transition-all border",
                    garmentFilter === cat
                      ? "bg-[#2D3A2F] text-[#F9F8F6] border-[#2D3A2F] font-semibold shadow-xs"
                      : "bg-[#FFFFFF] text-[#8C887B] border-[#EAE7E1] hover:text-[#1A1A1A]"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Custom Garment Upload Option */}
            <button
              onClick={() => garmentInputRef.current?.click()}
              className="w-full py-2.5 px-3 rounded-2xl border border-dashed border-[#2D3A2F]/40 bg-[#FFFFFF] hover:bg-[#F2EFE9] text-xs font-medium text-[#2D3A2F] flex items-center justify-center gap-2 transition-colors shadow-2xs"
            >
              <UploadCloud size={15} />
              <span>Upload photo of any garment</span>
            </button>

            {/* Wardrobe Items Grid */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {wardrobeList
                .filter((item) =>
                  garmentFilter === "all" ? true : item.category === garmentFilter
                )
                .map((item) => {
                  const isSelected = selectedGarment.imageUrl === item.imageUrl;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedGarment({
                          id: item.id,
                          name: item.name,
                          category: item.category,
                          imageUrl: item.imageUrl,
                          color: item.color,
                        });
                        setIsGarmentPickerOpen(false);
                        setVtonResultImage(null);
                      }}
                      className={cn(
                        "flex flex-col p-2.5 rounded-2xl border bg-[#FFFFFF] cursor-pointer transition-all hover:border-[#2D3A2F] active:scale-95 group shadow-2xs",
                        isSelected
                          ? "border-[#2D3A2F] ring-1 ring-[#2D3A2F]"
                          : "border-[#EAE7E1]"
                      )}
                    >
                      <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#EFECE6] mb-1.5">
                        <Image
                          src={item.imageUrl?.trim() ? item.imageUrl : getNeutralPlaceholder(item.category, item.color)}
                          alt={item.name}
                          fill
                          unoptimized
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 bg-[#2D3A2F] text-white p-1 rounded-full shadow-xs">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-[#1A1A1A] truncate group-hover:text-[#2D3A2F]">
                        {item.name}
                      </h4>
                      <span className="text-[10px] text-[#8C887B] capitalize">
                        {item.category}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Toast */}
      {isSavedToastOpen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1A1A1A] text-[#F9F8F6] px-4 py-2 rounded-full text-xs font-medium tracking-wide flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check size={14} className="text-emerald-400" strokeWidth={3} />
          <span>Look saved to your collection!</span>
        </div>
      )}
    </div>
  );
}

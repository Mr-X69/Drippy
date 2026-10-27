"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  X,
  Camera,
  ImagePlus,
  Sparkles,
  Waves,
  Check,
  Tag,
  Link as LinkIcon,
  RotateCcw,
  UploadCloud,
  FileText,
  ChevronDown,
  Trash2,
  Plus,
} from "lucide-react";
import {
  db,
  GarmentCategory,
  LaundryStatus,
  WardrobeItem,
} from "@/lib/db";
import { cn } from "@/lib/utils";
import { CLOTHING_COLORS, type PracticalColor } from "@/lib/colors";
import { getNeutralPlaceholder } from "@/lib/placeholders";

export { CLOTHING_COLORS, type PracticalColor };

interface AddGarmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGarmentAdded?: (item: WardrobeItem) => void;
}

export type IntakeMode = "single" | "bulk" | "receipt";

// Category options
const CATEGORY_CHIPS: { label: string; value: GarmentCategory }[] = [
  { label: "Top", value: "tops" },
  { label: "Bottom", value: "bottoms" },
  { label: "Outerwear", value: "outerwear" },
  { label: "Footwear", value: "shoes" },
  { label: "Accessory", value: "accessories" },
];

// Occasion options
const OCCASION_PILLS = [
  "College Casual",
  "Presentation / Formal",
  "Fest / Traditional",
  "Lab Day",
];

export interface QueuedBulkWardrobeItem {
  id: string;
  name: string;
  category: GarmentCategory;
  subCategory?: string;
  imageUrl: string;
  colorHex: string;
  brand?: string;
  occasions?: string[];
  status?: "pending" | "analyzing" | "done" | "error";
  errorMessage?: string;
}

export function parseCategoryFromAi(catRaw?: unknown): GarmentCategory {
  if (!catRaw || typeof catRaw !== "string") return "tops";
  const cat = catRaw.toLowerCase();
  if (
    cat.includes("bottom") ||
    cat.includes("pant") ||
    cat.includes("trouser") ||
    cat.includes("jean") ||
    cat.includes("short") ||
    cat.includes("chino")
  ) {
    return "bottoms";
  }
  if (cat.includes("outerwear") || cat.includes("jacket") || cat.includes("coat") || cat.includes("trench")) {
    return "outerwear";
  }
  if (cat.includes("footwear") || cat.includes("shoe") || cat.includes("sneaker") || cat.includes("boot") || cat.includes("derby")) {
    return "shoes";
  }
  if (cat.includes("accessory") || cat.includes("bag") || cat.includes("belt") || cat.includes("hat")) {
    return "accessories";
  }
  return "tops";
}

export function resolveColorFromAi(colorRaw?: unknown): PracticalColor {
  if (!colorRaw || typeof colorRaw !== "string") {
    return CLOTHING_COLORS.find((c) => c.name === "Olive") ?? CLOTHING_COLORS[0];
  }
  const cleanColor = colorRaw.trim().toLowerCase();

  // 1. Exact match
  const exact = CLOTHING_COLORS.find((c) => c.name.toLowerCase() === cleanColor);
  if (exact) return exact;

  // 2. Specific nuances before generic words
  if (cleanColor.includes("cream") || cleanColor.includes("off-white") || cleanColor.includes("ivory")) {
    return CLOTHING_COLORS.find((c) => c.name === "Cream")!;
  }
  if (cleanColor.includes("charcoal") || cleanColor.includes("anthracite")) {
    return CLOTHING_COLORS.find((c) => c.name === "Charcoal")!;
  }
  if (cleanColor.includes("navy")) {
    return CLOTHING_COLORS.find((c) => c.name === "Navy")!;
  }
  if (cleanColor.includes("wine") || cleanColor.includes("maroon") || cleanColor.includes("burgundy")) {
    return CLOTHING_COLORS.find((c) => c.name === "Wine / Maroon")!;
  }
  if (cleanColor.includes("forest") || cleanColor.includes("pine")) {
    return CLOTHING_COLORS.find((c) => c.name === "Forest Green")!;
  }
  if (cleanColor.includes("sage") || cleanColor.includes("mint")) {
    return CLOTHING_COLORS.find((c) => c.name === "Sage Green")!;
  }
  if (cleanColor.includes("mustard") || cleanColor.includes("ochre")) {
    return CLOTHING_COLORS.find((c) => c.name === "Mustard")!;
  }
  if (cleanColor.includes("olive") || cleanColor.includes("khaki")) {
    return CLOTHING_COLORS.find((c) => c.name === "Olive")!;
  }
  if (cleanColor.includes("slate") || cleanColor.includes("steel")) {
    return CLOTHING_COLORS.find((c) => c.name === "Slate")!;
  }
  if (cleanColor.includes("sand") || cleanColor.includes("tan")) {
    return CLOTHING_COLORS.find((c) => c.name === "Sand")!;
  }
  if (cleanColor.includes("beige") || cleanColor.includes("ecru")) {
    return CLOTHING_COLORS.find((c) => c.name === "Beige")!;
  }
  if (cleanColor.includes("white")) {
    return CLOTHING_COLORS.find((c) => c.name === "White")!;
  }
  if (cleanColor.includes("black")) {
    return CLOTHING_COLORS.find((c) => c.name === "Black")!;
  }
  if (cleanColor.includes("grey") || cleanColor.includes("gray")) {
    return CLOTHING_COLORS.find((c) => c.name === "Heather Grey")!;
  }

  // 3. Substring match against names
  const matched = CLOTHING_COLORS.find(
    (c) => cleanColor.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(cleanColor)
  );

  return matched ?? (CLOTHING_COLORS.find((c) => c.name === "Olive") ?? CLOTHING_COLORS[0]);
}

// Client-side image compression & format normalization to prevent large payload errors
function readAndCompressFile(file: File, maxDim = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        resolve("");
        return;
      }

      if (typeof window === "undefined" || !file.type.startsWith("image/")) {
        resolve(rawDataUrl);
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

export default function AddGarmentModal({
  isOpen,
  onClose,
  onGarmentAdded,
}: AddGarmentModalProps) {
  // Intake Mode: Single Photo | Bulk Upload | Paste Receipt
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("single");

  // Single Photo Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState<GarmentCategory>("tops");
  const [brand, setBrand] = useState("");
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([
    "College Casual",
  ]);
  const [laundryStatus, setLaundryStatus] = useState<LaundryStatus>("clean");
  const [selectedColor, setSelectedColor] = useState<PracticalColor>(
    () => CLOTHING_COLORS.find((c) => c.name === "Olive") ?? CLOTHING_COLORS[0]
  );
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isUrlInputOpen, setIsUrlInputOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Detection State
  const [isAIExtracting, setIsAIExtracting] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);

  // Bulk Upload State
  const [bulkQueue, setBulkQueue] = useState<QueuedBulkWardrobeItem[]>([]);
  const [bulkCategory, setBulkCategory] = useState<GarmentCategory>("tops");

  // Paste Receipt State
  const [receiptText, setReceiptText] = useState("");
  const [parsedReceiptItems, setParsedReceiptItems] = useState<
    { name: string; brand: string; category: GarmentCategory; colorHex: string }[]
  >([]);

  // State for Drag & Drop
  const [isDragging, setIsDragging] = useState(false);

  // Hidden File Inputs
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  // In-flight AI Request Ref
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeImageRef = useRef<string | null>(null);
  const prevIsOpenRef = useRef(false);

  // Reset temporary form state on every NEW garment-entry session
  const resetForm = () => {
    setName("");
    setCategory("tops");
    setBrand("");
    setSelectedOccasions(["College Casual"]);
    setLaundryStatus("clean");
    setSelectedColor(
      CLOTHING_COLORS.find((c) => c.name === "Olive") ?? CLOTHING_COLORS[0]
    );
    setIsColorDropdownOpen(false);
    setImageUrl("");
    setIsUrlInputOpen(false);
    setUrlDraft("");
    setIsSubmitting(false);

    // AI state reset
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("SESSION_RESET");
      abortControllerRef.current = null;
    }
    activeImageRef.current = null;
    setIsAIExtracting(false);
    setAiSuccessMessage(null);
    setAiErrorMessage(null);

    // Reset bulk & receipt states
    setBulkQueue([]);
    setBulkCategory("tops");
    setReceiptText("");
    setParsedReceiptItems([]);
    setIntakeMode("single");

    // Clear file inputs if mounted
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (bulkInputRef.current) bulkInputRef.current.value = "";
  };

  // Reset temporary form state whenever a NEW garment-entry session opens
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      resetForm();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const cancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("USER_CANCELLED");
      abortControllerRef.current = null;
    }
    activeImageRef.current = null;
    setIsAIExtracting(false);
    setAiErrorMessage("AI analysis cancelled. You can enter details manually.");
    setTimeout(() => {
      setAiErrorMessage((current) =>
        current === "AI analysis cancelled. You can enter details manually." ? null : current
      );
    }, 3500);
  };

  const handleModalClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  // Auto-tag piece with Gemini Flash via Route Handler
  const autoTagWithGemini = async (base64Image: string) => {
    if (!base64Image) return;

    // Prevent duplicate in-flight requests on the same image
    if (isAIExtracting && activeImageRef.current === base64Image) {
      return;
    }

    // Abort existing in-flight request if image changed
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("IMAGE_CHANGED");
      abortControllerRef.current = null;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    activeImageRef.current = base64Image;

    setIsAIExtracting(true);
    setAiSuccessMessage(null);
    setAiErrorMessage(null);

    try {
      const res = await fetch("/api/autotag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
        signal: controller.signal,
      });

      // Check if response is stale
      if (activeImageRef.current !== base64Image) {
        return;
      }

      if (!res.ok) {
        let errorText = `AI analysis failed (Status ${res.status})`;
        try {
          const errData = await res.json();
          if (errData.error && typeof errData.error === "string") {
            errorText = errData.error;
          }
        } catch {
          // Keep default status message
        }
        throw new Error(errorText);
      }

      const data = await res.json();
      if (data.fallback || data.error) {
        throw new Error(data.error || "Unable to extract garment details from this image");
      }

      // Pre-populate Form Fields from Gemini response
      if (activeImageRef.current === base64Image) {
        if (data.name && typeof data.name === "string") {
          setName(data.name);
        }

        if (data.category) {
          setCategory(parseCategoryFromAi(data.category));
        }

        if (data.color) {
          setSelectedColor(resolveColorFromAi(data.color));
        }

        if (Array.isArray(data.occasions) && data.occasions.length > 0) {
          const validOccasions = data.occasions.filter((o: string) =>
            OCCASION_PILLS.includes(o)
          );
          if (validOccasions.length > 0) {
            setSelectedOccasions(validOccasions);
          }
        }

        setAiSuccessMessage(`✨ Auto-tagged: ${data.name || "Garment"}`);
        setTimeout(() => setAiSuccessMessage(null), 3500);
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return;
      }

      console.warn("Gemini auto-tagging error:", err);
      const msg = err instanceof Error ? err.message : "Failed to analyze garment with AI";
      setAiErrorMessage(msg);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsAIExtracting(false);
      }
    }
  };

  // Analyze single item in bulk queue
  const analyzeBulkItem = async (itemId: string, base64: string) => {
    setBulkQueue((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, status: "analyzing", errorMessage: undefined }
          : item
      )
    );

    try {
      const res = await fetch("/api/autotag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        let errText = `HTTP error ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.error) errText = errData.error;
        } catch {}
        throw new Error(errText);
      }

      const data = await res.json();
      if (data.fallback || data.error) {
        throw new Error(data.error || "Could not analyze piece");
      }

      const resolvedCategory = parseCategoryFromAi(data.category);
      const resolvedColor = resolveColorFromAi(data.color);

      setBulkQueue((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: "done",
                name: data.name || item.name,
                category: resolvedCategory,
                subCategory: data.subCategory,
                colorHex: resolvedColor.hex,
                occasions: Array.isArray(data.occasions) ? data.occasions : ["College Casual"],
              }
            : item
        )
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Analysis failed";
      setBulkQueue((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, status: "error", errorMessage: errMsg }
            : item
        )
      );
    }
  };

  const updateBulkItem = (id: string, updates: Partial<QueuedBulkWardrobeItem>) => {
    setBulkQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // Handle Single Image Conversion to Base64 via readAndCompressFile & Trigger Auto-Tag
  const handleSingleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64String = await readAndCompressFile(file);
      if (base64String) {
        setImageUrl(base64String);
        autoTagWithGemini(base64String);
      }
    }
  };

  // Handle Drag & Drop on 3:4 dropzone with automatic compression
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const base64String = await readAndCompressFile(file);
      if (base64String) {
        setImageUrl(base64String);
        autoTagWithGemini(base64String);
      }
    }
  };

  // Handle Bulk Image Uploads with automatic compression & parallel Gemini autotagging
  const handleBulkFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: QueuedBulkWardrobeItem[] = [];

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const base64 = await readAndCompressFile(file);
      if (base64) {
        const cleanName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());

        const id = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
        newItems.push({
          id,
          name: cleanName || `Piece #${bulkQueue.length + index + 1}`,
          category: bulkCategory,
          imageUrl: base64,
          colorHex: CLOTHING_COLORS.find((c) => c.name === "Olive")?.hex ?? "#2D3A2F",
          brand: "Bulk Import",
          status: "pending",
        });
      }
    }

    if (newItems.length > 0) {
      setBulkQueue((prev) => [...prev, ...newItems]);
      // Process newly queued items with Gemini Vision
      newItems.forEach((item) => {
        analyzeBulkItem(item.id, item.imageUrl);
      });
    }

    if (e.target) {
      e.target.value = "";
    }
  };

  // Toggle Occasion Pills
  const toggleOccasion = (occ: string) => {
    setSelectedOccasions((prev) =>
      prev.includes(occ) ? prev.filter((o) => o !== occ) : [...prev, occ]
    );
  };

  // AI Vision Extraction Trigger
  const handleAIExtract = async () => {
    if (isAIExtracting) {
      cancelAnalysis();
      return;
    }

    if (imageUrl) {
      await autoTagWithGemini(imageUrl);
      return;
    }

    setAiSuccessMessage("Upload or drop a garment photo to analyze with Gemini Vision.");
    setTimeout(() => setAiSuccessMessage(null), 3000);
  };

  // Parse Receipt Text
  const handleParseReceipt = () => {
    if (!receiptText.trim()) return;
    setIsAIExtracting(true);

    setTimeout(() => {
      const lines = receiptText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 2);

      const detected = lines.map((line, idx) => {
        let cat: GarmentCategory = "tops";
        const lower = line.toLowerCase();
        if (lower.includes("pant") || lower.includes("trouser") || lower.includes("jean") || lower.includes("chino") || lower.includes("short")) {
          cat = "bottoms";
        } else if (lower.includes("jacket") || lower.includes("coat") || lower.includes("blazer") || lower.includes("trench")) {
          cat = "outerwear";
        } else if (lower.includes("shoe") || lower.includes("sneaker") || lower.includes("boot") || lower.includes("derby") || lower.includes("loafer")) {
          cat = "shoes";
        } else if (lower.includes("bag") || lower.includes("belt") || lower.includes("hat") || lower.includes("scarf")) {
          cat = "accessories";
        }

        let brandLabel = "Online Retail";
        if (lower.includes("zara")) brandLabel = "Zara";
        else if (lower.includes("uniqlo")) brandLabel = "Uniqlo";
        else if (lower.includes("myntra")) brandLabel = "Myntra";
        else if (lower.includes("ajio")) brandLabel = "Ajio";
        else if (lower.includes("h&m")) brandLabel = "H&M";

        return {
          name: line.replace(/item:|order:|\d+[\.,]\d+|rs\.?|inr|₹/gi, "").trim() || `Purchased Piece #${idx + 1}`,
          brand: brandLabel,
          category: cat,
          colorHex: CLOTHING_COLORS[idx % CLOTHING_COLORS.length].hex,
        };
      });

      setParsedReceiptItems(detected);
      setIsAIExtracting(false);
      setAiSuccessMessage(`✨ Extracted ${detected.length} items from receipt!`);
      setTimeout(() => setAiSuccessMessage(null), 3500);
    }, 600);
  };

  // Submit Single Garment
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const finalImage =
        imageUrl.trim() || getNeutralPlaceholder(category, selectedColor.hex);

      const subCategoryLabel =
        category === "shoes"
          ? "Footwear"
          : category === "bottoms"
          ? "Tailoring"
          : category === "outerwear"
          ? "Coats"
          : category === "accessories"
          ? "Bags & Gear"
          : "Knitwear & Shirts";

      const newGarment: Omit<WardrobeItem, "id"> = {
        name: name.trim(),
        category,
        subCategory: subCategoryLabel,
        brand: brand.trim() || "Unassigned",
        color: selectedColor.hex,
        imageUrl: finalImage,
        tags: [
          category,
          laundryStatus,
          ...selectedOccasions.map((o) => o.toLowerCase()),
        ],
        season: ["all-season"],
        occasions: selectedOccasions,
        laundryStatus,
        favorite: false,
        createdAt: Date.now(),
      };

      const newId = await db.wardrobe_items.add(newGarment);

      if (onGarmentAdded) {
        onGarmentAdded({ ...newGarment, id: Number(newId) });
      }

      resetForm();
      onClose();
    } catch (err) {
      console.error("Failed to add garment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Bulk Queue
  const handleBulkSubmit = async () => {
    if (bulkQueue.length === 0) return;
    setIsSubmitting(true);
    try {
      const itemsToAdd: Omit<WardrobeItem, "id">[] = bulkQueue.map((q) => ({
        name: q.name.trim() || "Curated Garment",
        category: q.category,
        subCategory: q.subCategory || (q.category === "shoes" ? "Footwear" : "Garment"),
        brand: q.brand?.trim() || "Bulk Import",
        color: q.colorHex,
        imageUrl: q.imageUrl,
        tags: [
          q.category,
          "clean",
          "bulk-import",
          ...(q.occasions || ["College Casual"]).map((o) => o.toLowerCase()),
        ],
        season: ["all-season"],
        occasions: q.occasions || ["College Casual"],
        laundryStatus: "clean",
        favorite: false,
        createdAt: Date.now(),
      }));

      await db.wardrobe_items.bulkAdd(itemsToAdd);

      if (onGarmentAdded && itemsToAdd.length > 0) {
        onGarmentAdded({ ...itemsToAdd[0], id: Date.now() });
      }

      resetForm();
      onClose();
    } catch (err) {
      console.error("Bulk add failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Parsed Receipt Items
  const handleReceiptSubmit = async () => {
    if (parsedReceiptItems.length === 0) return;
    setIsSubmitting(true);
    try {
      const itemsToAdd: Omit<WardrobeItem, "id">[] = parsedReceiptItems.map((p) => ({
        name: p.name,
        category: p.category,
        subCategory: p.category === "shoes" ? "Footwear" : "Tailoring",
        brand: p.brand,
        color: p.colorHex,
        imageUrl: getNeutralPlaceholder(p.category, p.colorHex),
        tags: [p.category, "clean", "receipt-import", p.brand.toLowerCase()],
        season: ["all-season"],
        occasions: ["College Casual", "Presentation / Formal"],
        laundryStatus: "clean",
        favorite: false,
        createdAt: Date.now(),
      }));

      await db.wardrobe_items.bulkAdd(itemsToAdd);

      if (onGarmentAdded && itemsToAdd.length > 0) {
        onGarmentAdded({ ...itemsToAdd[0], id: Date.now() });
      }

      resetForm();
      onClose();
    } catch (err) {
      console.error("Receipt items import failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop overlay dismiss */}
      <div className="absolute inset-0" onClick={handleModalClose} />

      {/* Slide-Up Bottom Sheet */}
      <div className="relative w-full max-w-md bg-[#F9F8F6] rounded-t-3xl border-t border-[#EAE7E1] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Drag Handle Pill */}
        <div
          className="w-10 h-1.5 bg-[#D8D4CC] rounded-full mx-auto mt-2.5 mb-1 cursor-pointer hover:bg-[#8C887B] transition-colors"
          onClick={handleModalClose}
        />

        {/* Modal Header with Title & Close */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#EAE7E1]">
          <div>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-[#8C887B]">
              Wardrobe Intake
            </span>
            <h2 className="text-lg font-bold tracking-tight text-[#1A1A1A] mt-0.5">
              Add Garments
            </h2>
          </div>

          <button
            onClick={handleModalClose}
            className="w-7 h-7 rounded-full bg-[#EFECE6] text-[#1A1A1A] flex items-center justify-center hover:bg-[#EAE7E1] transition-colors active:scale-95"
            aria-label="Close modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* 1. TOP INTAKE MODE SWITCHER (Horizontal Pill Tabs) */}
        <div className="px-5 pt-3 pb-2 border-b border-[#EAE7E1]/70 bg-[#F9F8F6]">
          <div className="flex p-1 bg-[#EFECE6] rounded-2xl border border-[#EAE7E1] text-xs font-medium">
            <button
              type="button"
              onClick={() => setIntakeMode("single")}
              className={cn(
                "flex-1 py-1.5 rounded-xl transition-all select-none text-[11px] font-medium tracking-wide flex items-center justify-center gap-1",
                intakeMode === "single"
                  ? "bg-[#2D3A2F] text-[#F9F8F6] shadow-xs font-semibold"
                  : "text-[#8C887B] hover:text-[#1A1A1A]"
              )}
            >
              <Camera size={13} />
              <span>Single Photo</span>
            </button>

            <button
              type="button"
              onClick={() => setIntakeMode("bulk")}
              className={cn(
                "flex-1 py-1.5 rounded-xl transition-all select-none text-[11px] font-medium tracking-wide flex items-center justify-center gap-1",
                intakeMode === "bulk"
                  ? "bg-[#2D3A2F] text-[#F9F8F6] shadow-xs font-semibold"
                  : "text-[#8C887B] hover:text-[#1A1A1A]"
              )}
            >
              <UploadCloud size={13} />
              <span>Bulk Upload</span>
            </button>

            <button
              type="button"
              onClick={() => setIntakeMode("receipt")}
              className={cn(
                "flex-1 py-1.5 rounded-xl transition-all select-none text-[11px] font-medium tracking-wide flex items-center justify-center gap-1",
                intakeMode === "receipt"
                  ? "bg-[#2D3A2F] text-[#F9F8F6] shadow-xs font-semibold"
                  : "text-[#8C887B] hover:text-[#1A1A1A]"
              )}
            >
              <FileText size={13} />
              <span>Paste Receipt</span>
            </button>
          </div>
        </div>

        {/* AI Notification Banner if triggered */}
        {aiSuccessMessage && (
          <div className="mx-5 mt-2 p-2 bg-[#EDF3EC] border border-[#2D3A2F]/20 rounded-xl text-xs text-[#2D3A2F] font-medium animate-in fade-in flex items-center justify-between">
            <span>{aiSuccessMessage}</span>
            <Check size={14} className="text-[#2D3A2F]" />
          </div>
        )}

        {/* AI Error Notification Banner with Retry action */}
        {aiErrorMessage && (
          <div className="mx-5 mt-2 p-2.5 bg-[#FDF2F0] border border-[#E08A7C]/40 rounded-xl text-xs text-[#9A4C3D] flex items-center justify-between gap-2 animate-in fade-in">
            <span className="flex-1 truncate" title={aiErrorMessage}>
              {aiErrorMessage}
            </span>
            {imageUrl && !isAIExtracting && (
              <button
                type="button"
                onClick={() => autoTagWithGemini(imageUrl)}
                className="px-2.5 py-1 rounded-lg bg-[#9A4C3D] text-white text-[10px] font-semibold flex items-center gap-1 hover:bg-[#833D30] transition-colors flex-shrink-0 active:scale-95 shadow-2xs cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        {/* ================= INTAKE MODE 1: SINGLE PHOTO ================= */}
        {intakeMode === "single" && (
          <form
            id="single-garment-form"
            onSubmit={handleSingleSubmit}
            className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 flex flex-col gap-5 pb-24"
          >
            {/* 3:4 Dashed Dropzone Area */}
            <div className="flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B]">
                  Garment Visual • 3:4 Dropzone
                </span>

                {/* 3. AI DETECTION TOGGLE CHIP */}
                {isAIExtracting ? (
                  <button
                    type="button"
                    onClick={cancelAnalysis}
                    className="px-2.5 py-1 rounded-full bg-[#FDF2F0] hover:bg-[#FBE8E5] text-[#9A4C3D] border border-[#E08A7C]/40 text-[10px] font-semibold tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
                    title="Click to cancel AI analysis"
                  >
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-[#9A4C3D]/30 border-t-[#9A4C3D] animate-spin" />
                    <span>Analyzing... (Cancel)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAIExtract}
                    className="px-2.5 py-1 rounded-full bg-[#EAECE6] hover:bg-[#E2E5DC] text-[#2D3A2F] border border-[#2D3A2F]/20 text-[10px] font-semibold tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
                  >
                    <Sparkles size={11} className="text-[#2D3A2F]" />
                    <span>Auto-fill with AI (Gemini Vision)</span>
                  </button>
                )}
              </div>

              {/* 3:4 Dropzone Frame */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  "relative aspect-[3/4] w-full max-w-[210px] rounded-2xl overflow-hidden border-2 transition-all flex flex-col items-center justify-center p-3 text-center",
                  isDragging
                    ? "border-[#2D3A2F] bg-[#EAECE6]/60 scale-[1.02]"
                    : imageUrl
                    ? "border-[#2D3A2F] shadow-sm bg-[#FFFFFF]"
                    : "border-dashed border-[#D8D4CC] bg-[#FFFFFF] hover:border-[#2D3A2F]/60"
                )}
              >
                {/* Non-blocking "Analyzing piece..." loading spinner over dropzone keeping photo visible */}
                {isAIExtracting && (
                  <div
                    className={cn(
                      "absolute inset-0 z-20 flex flex-col items-center justify-center p-3 text-center animate-in fade-in duration-200",
                      imageUrl
                        ? "bg-black/60 backdrop-blur-[2px] text-[#F9F8F6]"
                        : "bg-[#F9F8F6]/90 backdrop-blur-xs text-[#1A1A1A]"
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full border-2 animate-spin mb-2",
                        imageUrl
                          ? "border-white/30 border-t-white"
                          : "border-[#2D3A2F]/20 border-t-[#2D3A2F]"
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold tracking-wide",
                        imageUrl ? "text-white" : "text-[#1A1A1A]"
                      )}
                    >
                      Analyzing piece...
                    </span>
                    <span
                      className={cn(
                        "text-[10px] mt-0.5",
                        imageUrl ? "text-white/80" : "text-[#8C887B]"
                      )}
                    >
                      Gemini 3.8 Flash
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelAnalysis();
                      }}
                      className={cn(
                        "mt-2.5 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide flex items-center gap-1 transition-all active:scale-95 shadow-xs cursor-pointer",
                        imageUrl
                          ? "bg-white/20 hover:bg-white/30 text-white border border-white/40 backdrop-blur-xs"
                          : "bg-[#EFECE6] hover:bg-[#EAE7E1] text-[#9A4C3D] border border-[#E08A7C]/40"
                      )}
                      aria-label="Cancel AI analysis"
                    >
                      <X size={11} />
                      <span>Cancel Analysis</span>
                    </button>
                  </div>
                )}

                {imageUrl ? (
                  <>
                    <Image
                      src={imageUrl}
                      alt="Garment Preview"
                      fill
                      unoptimized={imageUrl.startsWith("data:")}
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

                    <button
                      type="button"
                      onClick={() => {
                        cancelAnalysis();
                        setImageUrl("");
                      }}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-[#1A1A1A]/80 text-[#F9F8F6] hover:bg-black transition-all shadow-xs backdrop-blur-xs cursor-pointer z-30"
                      title="Remove Photo"
                    >
                      <RotateCcw size={13} />
                    </button>

                    <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-full bg-[#F9F8F6]/90 backdrop-blur-md text-[9px] font-semibold tracking-wider text-[#1A1A1A] uppercase shadow-xs">
                      Ready to catalog
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2.5 w-full h-full">
                    <div className="w-11 h-11 rounded-full bg-[#F9F8F6] border border-[#EAE7E1] flex items-center justify-center text-[#2D3A2F]">
                      <Sparkles size={18} />
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-[#1A1A1A]">
                        Snap or Upload Photo
                      </span>
                      <span className="text-[10px] text-[#8C887B]">
                        3:4 Editorial Portrait
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#2D3A2F] text-[#F9F8F6] text-[11px] font-medium tracking-wide hover:bg-[#222c24] active:scale-95 transition-all shadow-xs"
                      >
                        <Camera size={13} />
                        <span>Camera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#EFECE6] border border-[#EAE7E1] text-[#1A1A1A] text-[11px] font-medium tracking-wide hover:bg-[#EAE7E1] active:scale-95 transition-all"
                      >
                        <ImagePlus size={13} />
                        <span>Gallery</span>
                      </button>
                    </div>
                  </div>
                )}

                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSingleFileChange}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleSingleFileChange}
                  className="hidden"
                />
              </div>

              {/* Optional URL Toggle */}
              <div className="mt-2 w-full max-w-[210px]">
                {!isUrlInputOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsUrlInputOpen(true)}
                    className="w-full text-center text-[10px] text-[#8C887B] hover:text-[#2D3A2F] flex items-center justify-center gap-1 py-1 transition-colors"
                  >
                    <LinkIcon size={11} />
                    <span>Or enter web image URL</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                      className="flex-1 bg-[#FFFFFF] border border-[#EAE7E1] rounded-lg px-2 py-1 text-[11px] text-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-[#2D3A2F]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (urlDraft.trim()) {
                          setImageUrl(urlDraft.trim());
                          setIsUrlInputOpen(false);
                        }
                      }}
                      className="px-2 py-1 bg-[#2D3A2F] text-[#F9F8F6] text-[10px] font-semibold rounded-lg hover:bg-[#222c24]"
                    >
                      Set
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsUrlInputOpen(false)}
                      className="p-1 text-[#8C887B] hover:text-[#1A1A1A]"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Garment Name & Brand */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B] block mb-1">
                  Garment Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pleated Slate Wool Trousers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#EAE7E1] rounded-xl px-3.5 py-2.5 text-xs text-[#1A1A1A] placeholder-[#8C887B] focus:outline-none focus:ring-1 focus:ring-[#2D3A2F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B] block mb-1">
                    Brand / Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Studio Nicholson, COS"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full bg-[#FFFFFF] border border-[#EAE7E1] rounded-xl px-3.5 py-2 text-xs text-[#1A1A1A] placeholder-[#8C887B] focus:outline-none focus:ring-1 focus:ring-[#2D3A2F]"
                  />
                </div>

                {/* 2. REFINED COLOR SELECTOR (Dropdown / Popover) */}
                <div className="relative">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B] block mb-1">
                    Color Swatch
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)}
                    className="w-full bg-[#FFFFFF] border border-[#EAE7E1] rounded-xl px-3 py-2 text-xs text-[#1A1A1A] flex items-center justify-between hover:border-[#2D3A2F]/40 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-xs flex-shrink-0"
                        style={{ backgroundColor: selectedColor.hex }}
                      />
                      <span className="font-medium truncate text-xs">
                        {selectedColor.name}
                      </span>
                    </div>
                    <ChevronDown size={14} className="text-[#8C887B]" />
                  </button>

                  {/* Clean Color Dropdown Popover */}
                  {isColorDropdownOpen && (
                    <>
                      {/* Click-outside backdrop */}
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setIsColorDropdownOpen(false)}
                      />
                      <div className="absolute bottom-full mb-1.5 right-0 w-60 z-30 bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl shadow-xl p-2 max-h-64 overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95 duration-150">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8C887B] px-2 py-1 border-b border-[#EAE7E1]/50 mb-1 flex items-center justify-between">
                          <span>Select Clothing Tone</span>
                          <span className="text-[9px] text-[#8C887B]/70">{CLOTHING_COLORS.length} tones</span>
                        </div>
                        <div className="grid grid-cols-1 gap-0.5">
                          {CLOTHING_COLORS.map((c) => (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => {
                                setSelectedColor(c);
                                setIsColorDropdownOpen(false);
                              }}
                              className={cn(
                                "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left",
                                selectedColor.name === c.name
                                  ? "bg-[#EAECE6] text-[#2D3A2F] font-semibold"
                                  : "hover:bg-[#F9F8F6] text-[#1A1A1A]"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-2xs flex-shrink-0"
                                  style={{ backgroundColor: c.hex }}
                                />
                                <span className="truncate">{c.name}</span>
                              </div>
                              {selectedColor.name === c.name && (
                                <Check size={13} className="text-[#2D3A2F] flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Category Horizontal Scroll Chips */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B] block mb-1.5">
                Category
              </label>
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
                {CATEGORY_CHIPS.map((chip) => {
                  const isSelected = category === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setCategory(chip.value)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all whitespace-nowrap select-none active:scale-95 border",
                        isSelected
                          ? "bg-[#2D3A2F] text-[#F9F8F6] border-[#2D3A2F] shadow-xs font-semibold"
                          : "bg-[#FFFFFF] text-[#8C887B] border-[#EAE7E1] hover:text-[#1A1A1A]"
                      )}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Occasion Pills */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B]">
                  Occasion Pairing
                </label>
                <span className="text-[10px] text-[#8C887B]">Select all that apply</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {OCCASION_PILLS.map((occ) => {
                  const isSelected = selectedOccasions.includes(occ);
                  return (
                    <button
                      key={occ}
                      type="button"
                      onClick={() => toggleOccasion(occ)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all select-none active:scale-95 border",
                        isSelected
                          ? "bg-[#EAECE6] text-[#2D3A2F] border-[#2D3A2F]/30 font-semibold shadow-2xs"
                          : "bg-[#FFFFFF] text-[#8C887B] border-[#EAE7E1] hover:text-[#1A1A1A]"
                      )}
                    >
                      {isSelected && <Check size={12} strokeWidth={2.5} />}
                      <span>{occ}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Laundry Status Toggle */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B] block mb-1.5">
                Laundry Status
              </label>

              <div className="grid grid-cols-2 gap-2 bg-[#EFECE6] p-1 rounded-2xl border border-[#EAE7E1]">
                <button
                  type="button"
                  onClick={() => setLaundryStatus("clean")}
                  className={cn(
                    "py-2 px-3 rounded-xl text-xs font-medium tracking-wide flex items-center justify-center gap-1.5 transition-all",
                    laundryStatus === "clean"
                      ? "bg-[#FFFFFF] text-[#2D3A2F] font-semibold shadow-xs"
                      : "text-[#8C887B] hover:text-[#1A1A1A]"
                  )}
                >
                  <Sparkles size={14} className={laundryStatus === "clean" ? "text-[#2D3A2F]" : "text-[#8C887B]"} />
                  <span>Clean & Ready</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLaundryStatus("in_wash")}
                  className={cn(
                    "py-2 px-3 rounded-xl text-xs font-medium tracking-wide flex items-center justify-center gap-1.5 transition-all",
                    laundryStatus === "in_wash"
                      ? "bg-[#FFFFFF] text-[#9A4C3D] font-semibold shadow-xs"
                      : "text-[#8C887B] hover:text-[#1A1A1A]"
                  )}
                >
                  <Waves size={14} className={laundryStatus === "in_wash" ? "text-[#9A4C3D]" : "text-[#8C887B]"} />
                  <span>In Wash / Hamper</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ================= INTAKE MODE 2: BULK UPLOAD ================= */}
        {intakeMode === "bulk" && (
          <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 flex flex-col gap-4 pb-24">
            <div className="bg-[#FFFFFF] border-2 border-dashed border-[#D8D4CC] rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#EFECE6] text-[#2D3A2F] flex items-center justify-center">
                <UploadCloud size={24} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#1A1A1A]">
                  Select Multiple Garment Photos
                </h4>
                <p className="text-xs text-[#8C887B] mt-0.5 max-w-xs">
                  Upload photos of tops, bottoms, and shoes all at once to rapidly build your wardrobe archive.
                </p>
              </div>

              <div className="flex items-center gap-3 mt-1">
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value as GarmentCategory)}
                  className="bg-[#EFECE6] border border-[#EAE7E1] rounded-xl px-3 py-1.5 text-xs text-[#1A1A1A] font-medium"
                >
                  <option value="tops">Default: Tops</option>
                  <option value="bottoms">Default: Bottoms</option>
                  <option value="outerwear">Default: Outerwear</option>
                  <option value="shoes">Default: Footwear</option>
                  <option value="accessories">Default: Accessories</option>
                </select>

                <button
                  type="button"
                  onClick={() => bulkInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-[#2D3A2F] text-[#F9F8F6] text-xs font-semibold tracking-wide hover:bg-[#222c24] transition-all shadow-xs"
                >
                  Browse Files
                </button>
              </div>

              <input
                ref={bulkInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleBulkFilesChange}
                className="hidden"
              />
            </div>

            {/* Queued Items List */}
            {bulkQueue.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs text-[#8C887B]">
                  <span className="font-semibold text-[#1A1A1A]">
                    {bulkQueue.length} {bulkQueue.length === 1 ? "item" : "items"} queued
                  </span>
                  <button
                    type="button"
                    onClick={() => setBulkQueue([])}
                    className="text-[#9A4C3D] hover:underline text-[11px]"
                  >
                    Clear queue
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {bulkQueue.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl p-3 flex gap-3 relative group shadow-2xs"
                    >
                      {/* Left: 3:4 Thumbnail with Status Overlay */}
                      <div className="relative aspect-[3/4] w-20 rounded-xl overflow-hidden bg-[#EFECE6] flex-shrink-0">
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                        {/* Overlay status */}
                        {item.status === "analyzing" && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex flex-col items-center justify-center p-1 text-center">
                            <Sparkles size={14} className="text-white animate-spin mb-1" />
                            <span className="text-[8px] font-semibold text-white">Analyzing</span>
                          </div>
                        )}
                        {item.status === "done" && (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-[#2D3A2F]/90 text-white text-[8px] font-bold flex items-center gap-0.5 shadow-xs">
                            <Check size={8} strokeWidth={3} /> AI
                          </span>
                        )}
                        {item.status === "error" && (
                          <div className="absolute inset-0 bg-[#9A4C3D]/80 backdrop-blur-2xs flex flex-col items-center justify-center p-1 text-center">
                            <span className="text-[8px] font-bold text-white mb-1">Failed</span>
                            <button
                              type="button"
                              onClick={() => analyzeBulkItem(item.id, item.imageUrl)}
                              className="px-1.5 py-0.5 bg-white text-[#9A4C3D] rounded text-[8px] font-bold shadow-xs active:scale-95"
                            >
                              Retry
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right: Editable Metadata Inputs */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateBulkItem(item.id, { name: e.target.value })}
                            placeholder="Garment Name"
                            className="w-full text-xs font-semibold text-[#1A1A1A] bg-[#F9F8F6] border border-[#EAE7E1] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#2D3A2F]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setBulkQueue((prev) => prev.filter((q) => q.id !== item.id))
                            }
                            className="text-[#8C887B] hover:text-[#9A4C3D] p-1 flex-shrink-0 transition-colors"
                            title="Remove Piece"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="text-[9px] font-semibold uppercase tracking-wider text-[#8C887B] block mb-0.5">
                              Category
                            </label>
                            <select
                              value={item.category}
                              onChange={(e) =>
                                updateBulkItem(item.id, {
                                  category: e.target.value as GarmentCategory,
                                })
                              }
                              className="w-full bg-[#F9F8F6] border border-[#EAE7E1] rounded-lg px-1.5 py-1 text-[11px] text-[#1A1A1A] font-medium capitalize"
                            >
                              <option value="tops">Top</option>
                              <option value="bottoms">Bottom</option>
                              <option value="outerwear">Outerwear</option>
                              <option value="shoes">Footwear</option>
                              <option value="accessories">Accessory</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-semibold uppercase tracking-wider text-[#8C887B] block mb-0.5">
                              Brand
                            </label>
                            <input
                              type="text"
                              value={item.brand || ""}
                              onChange={(e) =>
                                updateBulkItem(item.id, { brand: e.target.value })
                              }
                              placeholder="e.g. Zara"
                              className="w-full bg-[#F9F8F6] border border-[#EAE7E1] rounded-lg px-2 py-1 text-[11px] text-[#1A1A1A]"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[#EAE7E1]/50 text-[10px] text-[#8C887B]">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-3 h-3 rounded-full border border-black/20 shadow-2xs"
                              style={{ backgroundColor: item.colorHex }}
                            />
                            <span className="capitalize font-medium text-[#1A1A1A]">
                              {CLOTHING_COLORS.find((c) => c.hex.toLowerCase() === item.colorHex.toLowerCase())?.name || "Color"}
                            </span>
                          </div>

                          {item.status === "error" && (
                            <span className="text-[#9A4C3D] font-medium text-[9px] truncate max-w-[120px]">
                              {item.errorMessage || "AI error"}
                            </span>
                          )}
                          {item.status === "done" && (
                            <span className="text-[#2D3A2F] font-semibold text-[9px]">
                              ✓ Ready
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= INTAKE MODE 3: PASTE RECEIPT / TEXT ================= */}
        {intakeMode === "receipt" && (
          <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 flex flex-col gap-4 pb-24">
            <div className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl p-4 flex flex-col gap-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#1A1A1A]">
                    Order Confirmation Receipt
                  </h4>
                  <p className="text-[10px] text-[#8C887B]">
                    Paste order text from Myntra, Ajio, Zara, Uniqlo, or emails.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setReceiptText(
                      "Zara Relaxed Linen Camp Collar Shirt White\nUniqlo Wide Fit Pleated Chino Olive\nStudio Nicholson Calfskin Derby Shoes Black\nCOS Wool Minimalist Overcoat Charcoal"
                    )
                  }
                  className="px-2 py-1 rounded-lg bg-[#EFECE6] text-[#2D3A2F] text-[10px] font-medium hover:bg-[#E2E5DC] transition-colors"
                >
                  Load Example
                </button>
              </div>

              <textarea
                rows={5}
                placeholder="Paste order confirmation text, item names, or item lines here..."
                value={receiptText}
                onChange={(e) => setReceiptText(e.target.value)}
                className="w-full bg-[#F9F8F6] border border-[#EAE7E1] rounded-xl p-3 text-xs text-[#1A1A1A] placeholder-[#8C887B] focus:outline-none focus:ring-1 focus:ring-[#2D3A2F]"
              />

              <button
                type="button"
                onClick={handleParseReceipt}
                disabled={isAIExtracting || !receiptText.trim()}
                className={cn(
                  "py-2.5 px-4 rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all shadow-xs",
                  !receiptText.trim() || isAIExtracting
                    ? "bg-[#EFECE6] text-[#8C887B] cursor-not-allowed"
                    : "bg-[#2D3A2F] text-[#F9F8F6] hover:bg-[#222c24]"
                )}
              >
                <Sparkles size={14} className={isAIExtracting ? "animate-spin" : ""} />
                <span>{isAIExtracting ? "Extracting Pieces..." : "✨ Extract Pieces with AI"}</span>
              </button>
            </div>

            {/* Extracted Pieces Preview */}
            {parsedReceiptItems.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-[#1A1A1A]">
                  Extracted {parsedReceiptItems.length} Garments Ready to Add:
                </span>

                <div className="flex flex-col gap-2">
                  {parsedReceiptItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-[#FFFFFF] border border-[#EAE7E1] rounded-xl p-2.5 flex items-center justify-between shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20"
                          style={{ backgroundColor: item.colorHex }}
                        />
                        <div>
                          <h5 className="text-xs font-semibold text-[#1A1A1A]">
                            {item.name}
                          </h5>
                          <span className="text-[10px] text-[#8C887B]">
                            {item.brand} • <span className="capitalize">{item.category}</span>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setParsedReceiptItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-[#8C887B] hover:text-[#9A4C3D] p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. STICKY PRIMARY ACTION BUTTON (Deep Forest Olive #2D3A2F) */}
        <div className="sticky bottom-0 bg-[#F9F8F6]/95 backdrop-blur-md px-5 pt-3 pb-7 border-t border-[#EAE7E1] z-20">
          {intakeMode === "single" ? (
            <button
              type="submit"
              form="single-garment-form"
              disabled={isSubmitting || !name.trim()}
              className={cn(
                "w-full py-3.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all shadow-md active:scale-98 flex items-center justify-center gap-2",
                !name.trim() || isSubmitting
                  ? "bg-[#2D3A2F]/50 text-[#F9F8F6] cursor-not-allowed"
                  : "bg-[#2D3A2F] text-[#F9F8F6] hover:bg-[#222c24]"
              )}
            >
              <Tag size={14} />
              <span>{isSubmitting ? "Cataloging..." : "Add to Wardrobe"}</span>
            </button>
          ) : intakeMode === "bulk" ? (
            <button
              type="button"
              onClick={handleBulkSubmit}
              disabled={isSubmitting || bulkQueue.length === 0}
              className={cn(
                "w-full py-3.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all shadow-md active:scale-98 flex items-center justify-center gap-2",
                bulkQueue.length === 0 || isSubmitting
                  ? "bg-[#2D3A2F]/50 text-[#F9F8F6] cursor-not-allowed"
                  : "bg-[#2D3A2F] text-[#F9F8F6] hover:bg-[#222c24]"
              )}
            >
              <Plus size={14} />
              <span>
                {isSubmitting
                  ? "Importing Batch..."
                  : `Add ${bulkQueue.length} Pieces to Wardrobe`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReceiptSubmit}
              disabled={isSubmitting || parsedReceiptItems.length === 0}
              className={cn(
                "w-full py-3.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all shadow-md active:scale-98 flex items-center justify-center gap-2",
                parsedReceiptItems.length === 0 || isSubmitting
                  ? "bg-[#2D3A2F]/50 text-[#F9F8F6] cursor-not-allowed"
                  : "bg-[#2D3A2F] text-[#F9F8F6] hover:bg-[#222c24]"
              )}
            >
              <Plus size={14} />
              <span>
                {isSubmitting
                  ? "Importing..."
                  : `Add ${parsedReceiptItems.length} Pieces from Receipt`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

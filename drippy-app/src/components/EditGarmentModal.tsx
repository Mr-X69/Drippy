"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  X,
  Sparkles,
  Waves,
  Check,
  ChevronDown,
  Trash2,
  Camera,
  Link as LinkIcon,
  Tag,
  AlertTriangle,
} from "lucide-react";
import {
  db,
  GarmentCategory,
  LaundryStatus,
  WardrobeItem,
  safeDeleteWardrobeItem,
} from "@/lib/db";
import { cn } from "@/lib/utils";
import { CLOTHING_COLORS, type PracticalColor } from "@/lib/colors";
import { getNeutralPlaceholder } from "@/lib/placeholders";

interface EditGarmentModalProps {
  item: WardrobeItem | null;
  isOpen: boolean;
  onClose: () => void;
  onGarmentUpdated?: (updated: WardrobeItem) => void;
  onGarmentDeleted?: (id: number) => void;
}

const CATEGORY_CHIPS: { label: string; value: GarmentCategory }[] = [
  { label: "Top", value: "tops" },
  { label: "Bottom", value: "bottoms" },
  { label: "Outerwear", value: "outerwear" },
  { label: "Footwear", value: "shoes" },
  { label: "Accessory", value: "accessories" },
  { label: "One-Piece", value: "one-piece" },
];

const OCCASION_PILLS = [
  "College Casual",
  "Presentation / Formal",
  "Fest / Traditional",
  "Lab Day",
];

export default function EditGarmentModal({
  item,
  isOpen,
  onClose,
  onGarmentUpdated,
  onGarmentDeleted,
}: EditGarmentModalProps) {
  if (!isOpen || !item || !item.id) return null;

  return (
    <EditGarmentSheet
      key={item.id}
      item={item}
      onClose={onClose}
      onGarmentUpdated={onGarmentUpdated}
      onGarmentDeleted={onGarmentDeleted}
    />
  );
}

interface EditGarmentSheetProps {
  item: WardrobeItem;
  onClose: () => void;
  onGarmentUpdated?: (updated: WardrobeItem) => void;
  onGarmentDeleted?: (id: number) => void;
}

function EditGarmentSheet({
  item,
  onClose,
  onGarmentUpdated,
  onGarmentDeleted,
}: EditGarmentSheetProps) {
  const [name, setName] = useState(item.name || "");
  const [category, setCategory] = useState<GarmentCategory>(
    (item.category || "tops") as GarmentCategory
  );
  const [subCategory, setSubCategory] = useState(item.subCategory || "");
  const [brand, setBrand] = useState(item.brand || "");
  const [selectedColor, setSelectedColor] = useState<PracticalColor>(() => {
    return (
      CLOTHING_COLORS.find(
        (c) => c.hex.toLowerCase() === (item.color || "").toLowerCase()
      ) ||
      CLOTHING_COLORS.find(
        (c) => c.name.toLowerCase() === (item.color || "").toLowerCase()
      ) ||
      CLOTHING_COLORS[0]
    );
  });
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(
    () => item.occasions || ["College Casual"]
  );
  const [laundryStatus, setLaundryStatus] = useState<LaundryStatus>(
    item.laundryStatus || "clean"
  );
  const [imageUrl, setImageUrl] = useState(item.imageUrl || "");
  const [isUrlInputOpen, setIsUrlInputOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setImageUrl(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleOccasion = (occ: string) => {
    setSelectedOccasions((prev) =>
      prev.includes(occ) ? prev.filter((o) => o !== occ) : [...prev, occ]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !item.id) return;

    setIsSubmitting(true);
    try {
      const finalImage =
        imageUrl.trim() || getNeutralPlaceholder(category, selectedColor.hex);

      const updatedFields: Partial<WardrobeItem> = {
        name: name.trim(),
        category,
        subCategory: subCategory.trim() || undefined,
        brand: brand.trim() || undefined,
        color: selectedColor.hex,
        imageUrl: finalImage,
        tags: [
          category,
          laundryStatus,
          ...selectedOccasions.map((o) => o.toLowerCase()),
        ],
        occasions: selectedOccasions,
        laundryStatus,
        updatedAt: Date.now(),
      };

      await db.wardrobe_items.update(item.id, updatedFields);

      const fullUpdated: WardrobeItem = {
        ...item,
        ...updatedFields,
      };

      if (onGarmentUpdated) {
        onGarmentUpdated(fullUpdated);
      }

      onClose();
    } catch (err) {
      console.error("Failed to update garment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!item.id) return;
    setIsSubmitting(true);
    try {
      await safeDeleteWardrobeItem(item.id);
      if (onGarmentDeleted) {
        onGarmentDeleted(item.id);
      }
      onClose();
    } catch (err) {
      console.error("Failed to delete garment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#F9F8F6] rounded-t-3xl border-t border-[#EAE7E1] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Grab Handle */}
        <div
          className="w-10 h-1.5 bg-[#D8D4CC] rounded-full mx-auto mt-2.5 mb-1 cursor-pointer hover:bg-[#8C887B] transition-colors"
          onClick={onClose}
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#EAE7E1]">
          <div>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-[#8C887B]">
              Wardrobe Piece
            </span>
            <h2 className="text-lg font-bold tracking-tight text-[#1A1A1A] mt-0.5">
              Edit Garment
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#EFECE6] text-[#1A1A1A] flex items-center justify-center hover:bg-[#EAE7E1] transition-colors active:scale-95"
            aria-label="Close modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form Body */}
        <form
          id="edit-garment-form"
          onSubmit={handleSave}
          className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 flex flex-col gap-4 pb-24"
        >
          {/* Top Image Preview + Change Actions */}
          <div className="flex items-center gap-4 bg-[#FFFFFF] p-3 rounded-2xl border border-[#EAE7E1]">
            <div className="relative aspect-[3/4] w-20 rounded-xl overflow-hidden bg-[#EFECE6] flex-shrink-0">
              <Image
                src={imageUrl || getNeutralPlaceholder(category, selectedColor.hex)}
                alt={name || "Garment preview"}
                fill
                unoptimized
                className="object-cover"
              />
            </div>

            <div className="flex-1 flex flex-col justify-center gap-2">
              <span className="text-xs font-semibold text-[#1A1A1A]">
                Garment Visual
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-xl bg-[#EFECE6] text-[#1A1A1A] text-[11px] font-medium flex items-center gap-1 hover:bg-[#E2E0D8] transition-colors"
                >
                  <Camera size={12} />
                  <span>Replace Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsUrlInputOpen(!isUrlInputOpen)}
                  className="px-2.5 py-1.5 rounded-xl border border-[#EAE7E1] text-[#8C887B] hover:text-[#1A1A1A] text-[11px] font-medium flex items-center gap-1"
                >
                  <LinkIcon size={12} />
                  <span>URL</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />

              {isUrlInputOpen && (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="url"
                    placeholder="Paste image URL..."
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    className="flex-1 text-[11px] bg-[#F9F8F6] border border-[#EAE7E1] rounded-lg px-2 py-1 text-[#1A1A1A]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (urlDraft.trim()) {
                        setImageUrl(urlDraft.trim());
                        setUrlDraft("");
                        setIsUrlInputOpen(false);
                      }
                    }}
                    className="px-2 py-1 bg-[#2D3A2F] text-white text-[11px] rounded-lg"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Garment Name */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B] block mb-1.5">
              Garment Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pleated Slate Wool Trousers"
              className="w-full bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl px-4 py-3 text-xs text-[#1A1A1A] placeholder-[#8C887B] focus:outline-none focus:ring-1 focus:ring-[#2D3A2F] font-medium"
            />
          </div>

          {/* Category Chips */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B] block mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_CHIPS.map((cat) => {
                const isSelected = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={cn(
                      "py-2 px-3 rounded-xl text-xs font-medium tracking-wide transition-all border",
                      isSelected
                        ? "bg-[#2D3A2F] text-[#F9F8F6] border-[#2D3A2F] font-semibold shadow-2xs"
                        : "bg-[#FFFFFF] text-[#8C887B] border-[#EAE7E1] hover:text-[#1A1A1A]"
                    )}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brand & Subcategory in 2 Columns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B] block mb-1.5">
                Brand
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Studio Nicholson"
                className="w-full bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl px-3.5 py-2.5 text-xs text-[#1A1A1A] placeholder-[#8C887B] focus:outline-none focus:ring-1 focus:ring-[#2D3A2F]"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B] block mb-1.5">
                Sub-Category
              </label>
              <input
                type="text"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                placeholder="e.g. Tailoring / Knitwear"
                className="w-full bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl px-3.5 py-2.5 text-xs text-[#1A1A1A] placeholder-[#8C887B] focus:outline-none focus:ring-1 focus:ring-[#2D3A2F]"
              />
            </div>
          </div>

          {/* Color Tone Swatch Dropdown */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B] block mb-1.5">
              Primary Color Tone
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)}
                className="w-full bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl p-2.5 flex items-center justify-between text-xs text-[#1A1A1A] shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                    style={{ backgroundColor: selectedColor.hex }}
                  />
                  <span className="font-semibold">{selectedColor.name}</span>
                  <span className="text-[10px] text-[#8C887B] uppercase tracking-wider">
                    {selectedColor.hex}
                  </span>
                </div>
                <ChevronDown size={14} className="text-[#8C887B]" />
              </button>

              {isColorDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#FFFFFF] border border-[#EAE7E1] rounded-2xl p-2 shadow-xl z-30 max-h-48 overflow-y-auto no-scrollbar grid grid-cols-2 gap-1 animate-in fade-in zoom-in-95">
                  {CLOTHING_COLORS.map((col) => (
                    <button
                      key={col.hex + col.name}
                      type="button"
                      onClick={() => {
                        setSelectedColor(col);
                        setIsColorDropdownOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 p-1.5 rounded-xl text-left text-xs transition-colors",
                        selectedColor.name === col.name
                          ? "bg-[#EFECE6] font-semibold"
                          : "hover:bg-[#F9F8F6]"
                      )}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0"
                        style={{ backgroundColor: col.hex }}
                      />
                      <span className="truncate">{col.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Suitable Occasions */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8C887B] block mb-1.5">
              Suitable Occasions
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OCCASION_PILLS.map((occ) => {
                const isSelected = selectedOccasions.includes(occ);
                return (
                  <button
                    key={occ}
                    type="button"
                    onClick={() => toggleOccasion(occ)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all border flex items-center gap-1",
                      isSelected
                        ? "bg-[#2D3A2F] text-[#F9F8F6] border-[#2D3A2F] font-semibold shadow-2xs"
                        : "bg-[#FFFFFF] text-[#8C887B] border-[#EAE7E1] hover:text-[#1A1A1A]"
                    )}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
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
                <Sparkles
                  size={14}
                  className={laundryStatus === "clean" ? "text-[#2D3A2F]" : "text-[#8C887B]"}
                />
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
                <Waves
                  size={14}
                  className={laundryStatus === "in_wash" ? "text-[#9A4C3D]" : "text-[#8C887B]"}
                />
                <span>In Wash / Hamper</span>
              </button>
            </div>
          </div>

          {/* Danger Zone: Delete Garment */}
          <div className="pt-2 border-t border-[#EAE7E1]">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2.5 px-3 rounded-2xl border border-[#EAE7E1] text-[#9A4C3D] hover:bg-[#FDF2F0] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 size={13} />
                <span>Delete Garment from Wardrobe</span>
              </button>
            ) : (
              <div className="p-3 bg-[#FDF2F0] border border-[#E08A7C]/40 rounded-2xl flex flex-col gap-2 animate-in fade-in">
                <div className="flex items-start gap-2 text-xs text-[#9A4C3D]">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>
                    Are you sure? This will remove <strong>{name}</strong> from your collection and clear references in planned slots.
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="flex-1 py-1.5 rounded-xl bg-[#9A4C3D] text-white text-xs font-semibold hover:bg-[#833D30] transition-colors"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-1.5 rounded-xl border border-[#D8D4CC] text-[#1A1A1A] text-xs font-medium hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Sticky Action Footer */}
        <div className="sticky bottom-0 bg-[#F9F8F6]/95 backdrop-blur-md px-5 pt-3 pb-7 border-t border-[#EAE7E1] z-20">
          <button
            type="submit"
            form="edit-garment-form"
            disabled={isSubmitting || !name.trim()}
            className={cn(
              "w-full py-3.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all shadow-md active:scale-98 flex items-center justify-center gap-2",
              !name.trim() || isSubmitting
                ? "bg-[#2D3A2F]/50 text-[#F9F8F6] cursor-not-allowed"
                : "bg-[#2D3A2F] text-[#F9F8F6] hover:bg-[#222c24]"
            )}
          >
            <Tag size={14} />
            <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

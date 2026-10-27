import { WardrobeItem } from "./db";
import { WeatherData } from "./weather";

export type OutfitOccasion =
  | "casual"
  | "college"
  | "work"
  | "dinner"
  | "gym"
  | "outing"
  | "formal"
  | "rest";

export type GarmentRole =
  | "top"
  | "bottom"
  | "footwear"
  | "one_piece"
  | "outerwear"
  | "accessory";

export interface OutfitPieceAssignment {
  role: GarmentRole;
  item: WardrobeItem;
}

export interface CuratedOutfit {
  id?: string;
  structure: "standard" | "one_piece" | "layered" | "partial_top_bottom";
  occasion: OutfitOccasion;
  pieces: OutfitPieceAssignment[];
  top?: WardrobeItem;
  bottom?: WardrobeItem;
  footwear?: WardrobeItem;
  onePiece?: WardrobeItem;
  outerwear?: WardrobeItem;
  accessory?: WardrobeItem;
  harmonyScore: number; // 0.0 to 10.0 scale
  harmonyPercentage: number; // 0 to 100%
  breakdown: {
    colorScore: number; // 0 to 35
    formalityScore: number; // 0 to 35
    weatherScore: number; // 0 to 20
    bonusScore: number; // 0 to 10
  };
  reasoning: string;
  isPartial?: boolean;
  missingCategory?: "footwear" | "bottoms" | "tops";
  missingReason?: "absent" | "in_laundry";
  missingExplanation?: string;
}

export interface OutfitRecommendationResult {
  success: boolean;
  outfit?: CuratedOutfit;
  error?: string;
  reasonCode?:
    | "EMPTY_INVENTORY"
    | "INSUFFICIENT_CLEAN_ITEMS"
    | "MISSING_FOOTWEAR"
    | "MISSING_TOPS_OR_BOTTOMS"
    | "NO_ACTIVEWEAR_FOR_GYM"
    | "NO_VALID_COMBINATIONS"
    | "PARTIAL_OUTFIT";
  isPartial?: boolean;
  missingCategory?: "footwear" | "bottoms" | "tops";
  missingReason?: "absent" | "in_laundry";
}

/**
 * Normalizes user-entered category strings to canonical GarmentRole
 */
export function normalizeCategoryToRole(category: string, subCategory?: string): GarmentRole {
  const cat = (category || "").toLowerCase().trim();
  const sub = (subCategory || "").toLowerCase().trim();

  if (
    cat === "one-piece" ||
    cat === "one_piece" ||
    cat === "dress" ||
    cat === "dresses" ||
    cat === "jumpsuit" ||
    cat === "jumpsuits" ||
    sub.includes("dress")
  ) {
    return "one_piece";
  }
  if (cat === "tops" || cat === "top" || sub.includes("shirt") || sub.includes("tee")) {
    return "top";
  }
  if (cat === "bottoms" || cat === "bottom" || sub.includes("trouser") || sub.includes("pants") || sub.includes("shorts")) {
    return "bottom";
  }
  if (cat === "shoes" || cat === "footwear" || cat.includes("sneaker") || sub.includes("sneaker") || sub.includes("derby") || sub.includes("boot")) {
    return "footwear";
  }
  if (cat === "outerwear" || cat.includes("jacket") || sub.includes("coat") || sub.includes("jacket") || sub.includes("trench")) {
    return "outerwear";
  }
  if (cat === "accessories" || cat === "accessory" || cat.includes("bag") || sub.includes("bag") || sub.includes("tote")) {
    return "accessory";
  }

  // Fallback heuristics
  if (cat.includes("pant") || cat.includes("denim") || cat.includes("skirt")) return "bottom";
  if (cat.includes("boot") || cat.includes("shoe")) return "footwear";
  if (cat.includes("coat") || cat.includes("jacket")) return "outerwear";
  return "top";
}

/**
 * Formality Classification
 */
export type FormalityLevel = "activewear" | "casual" | "smart_casual" | "formal";

export function getGarmentFormality(item: WardrobeItem): FormalityLevel {
  const tags = (item.tags || []).map((t) => t.toLowerCase());
  const sub = (item.subCategory || "").toLowerCase();
  const name = (item.name || "").toLowerCase();

  const isActive =
    tags.some((t) => t === "gym" || t === "activewear" || t === "athletic" || t === "training" || t === "running") ||
    sub.includes("athletic") ||
    sub.includes("training") ||
    sub.includes("running") ||
    name.includes("seamless") ||
    name.includes("pump cover") ||
    name.includes("linerless") ||
    name.includes("metcon");

  if (isActive) return "activewear";

  const isFormal =
    tags.some((t) => t === "formal" || t === "tailored" || t === "business") ||
    sub.includes("tailoring") ||
    sub.includes("suit") ||
    sub.includes("blazer") ||
    sub.includes("derby") ||
    name.includes("wool trousers") ||
    name.includes("overcoat");

  if (isFormal) return "formal";

  const isSmartCasual =
    tags.some((t) => t === "smart" || t === "editorial" || t === "luxury") ||
    sub.includes("knitwear") ||
    sub.includes("collar") ||
    sub.includes("linen") ||
    sub.includes("denim") ||
    name.includes("cashmere") ||
    name.includes("camp collar") ||
    name.includes("derby");

  if (isSmartCasual) return "smart_casual";

  return "casual";
}

/**
 * Color Family Classification for Deterministic Harmony
 */
export type ColorFamily =
  | "black"
  | "white"
  | "grey"
  | "earth_beige"
  | "navy_blue"
  | "forest_green"
  | "warm_accent"
  | "cool_accent";

export function mapColorToFamily(colorStr?: string): ColorFamily {
  if (!colorStr) return "grey";
  const str = colorStr.toLowerCase().trim();

  // Common editorial hexes
  if (["#000000", "#111111", "#1a1a1a", "#222222", "#333333"].includes(str) || str.includes("black") || str.includes("pitch")) {
    return "black";
  }
  if (["#ffffff", "#f9f8f6", "#faf9f5", "#f0ede6"].includes(str) || str.includes("white") || str.includes("alabaster") || str.includes("ivory") || str.includes("cream")) {
    return "white";
  }
  if (["#efece6", "#e2d9c8", "#eae7e1", "#c4b5a0"].includes(str) || str.includes("ecru") || str.includes("beige") || str.includes("sand") || str.includes("khaki") || str.includes("tan") || str.includes("camel") || str.includes("brown")) {
    return "earth_beige";
  }
  if (["#2d3a2f", "#3a4d39", "#4f6352"].includes(str) || str.includes("forest") || str.includes("olive") || str.includes("green") || str.includes("sage")) {
    return "forest_green";
  }
  if (["#2b3a42", "#4a6b82", "#1d2a44", "#000080", "#0000ff", "#1e3a8a"].includes(str) || str.includes("navy") || str.includes("denim") || str.includes("cobalt") || str.includes("blue")) {
    return "navy_blue";
  }
  if (["#a8a8a8", "#8c887b", "#777777", "#808080"].includes(str) || str.includes("grey") || str.includes("gray") || str.includes("slate") || str.includes("charcoal")) {
    return "grey";
  }
  if (["#e6c641", "#c0392b", "#d35400"].includes(str) || str.includes("mustard") || str.includes("yellow") || str.includes("crimson") || str.includes("red") || str.includes("orange") || str.includes("rust") || str.includes("terracotta")) {
    return "warm_accent";
  }

  return "earth_beige";
}

/**
 * Deterministic Color Harmony Calculation between garment color families (0 to 35 pts)
 */
export function evaluateColorHarmony(families: ColorFamily[]): { score: number; reasoning: string } {
  if (families.length === 0) return { score: 25, reasoning: "Neutral color balance." };

  const neutrals: ColorFamily[] = ["black", "white", "grey", "earth_beige"];
  const allNeutral = families.every((f) => neutrals.includes(f));
  const uniqueFamilies = Array.from(new Set(families));

  // Monochromatic or clean single family with neutrals
  if (uniqueFamilies.length === 1) {
    return {
      score: 33,
      reasoning: `Sophisticated monochromatic ${uniqueFamilies[0].replace("_", " ")} palette.`,
    };
  }

  // All neutrals (e.g. Alabaster top + Slate trousers + White sneakers)
  if (allNeutral) {
    return {
      score: 34,
      reasoning: "Disciplined quiet-luxury neutral palette with subtle value contrast.",
    };
  }

  // Neutral anchor + 1 accent tone (e.g., Cream top + Navy denim or Mustard top + Slate trousers)
  const nonNeutrals = families.filter((f) => !neutrals.includes(f));
  if (nonNeutrals.length === 1) {
    return {
      score: 32,
      reasoning: `Clean focal ${nonNeutrals[0].replace("_", " ")} balanced by grounding neutral foundations.`,
    };
  }

  // Classic complementary pairs (Forest Green + Earth Beige, Navy Blue + Earth Beige)
  const hasForestAndEarth = families.includes("forest_green") && families.includes("earth_beige");
  const hasNavyAndEarth = families.includes("navy_blue") && families.includes("earth_beige");
  const hasForestAndBlack = families.includes("forest_green") && families.includes("black");

  if (hasForestAndEarth || hasNavyAndEarth || hasForestAndBlack) {
    return {
      score: 31,
      reasoning: "Harmonious complementary earth and natural tones with rich visual depth.",
    };
  }

  // Multiple competing non-neutral accents without neutral anchor
  if (nonNeutrals.length >= 3) {
    return {
      score: 18,
      reasoning: "Competing high-saturation accent colors without sufficient neutral balance.",
    };
  }

  // Multiple accent clash check (e.g. warm red + forest green without neutral dominance)
  const hasWarmAndCool = families.includes("warm_accent") && (families.includes("forest_green") || families.includes("cool_accent"));
  if (hasWarmAndCool && !allNeutral) {
    return {
      score: 20,
      reasoning: "High-contrast dynamic palette with contrasting tonal temperatures.",
    };
  }

  return {
    score: 28,
    reasoning: "Balanced, coordinated palette with cohesive tonal transitions.",
  };
}

/**
 * Formality and Occasion Suitability (0 to 35 pts)
 */
export function evaluateFormalityMatch(
  pieces: WardrobeItem[],
  occasion: OutfitOccasion
): { score: number; isValid: boolean; reasoning: string } {
  const formalities = pieces.map(getGarmentFormality);

  // Strict Gym Rule: activewear only
  if (occasion === "gym") {
    const nonActive = pieces.filter((p) => getGarmentFormality(p) !== "activewear");
    if (nonActive.length > 0) {
      return {
        score: 0,
        isValid: false,
        reasoning: `Gym slot strictly requires activewear. Non-athletic item '${nonActive[0].name}' rejected.`,
      };
    }
    return {
      score: 35,
      isValid: true,
      reasoning: "High-mobility, breathable performance activewear optimized for training.",
    };
  }

  // For non-gym occasions, athletic gym shorts/tees should not be paired with formal derbies or tailored coats
  const hasActivewear = formalities.includes("activewear");
  const hasFormal = formalities.includes("formal");

  if (hasActivewear && hasFormal) {
    return {
      score: 10,
      isValid: false,
      reasoning: "Formality conflict: activewear cannot be paired with formal tailored pieces.",
    };
  }

  if (occasion === "work") {
    if (hasActivewear) {
      return {
        score: 5,
        isValid: false,
        reasoning: "Activewear is not suitable for work environment.",
      };
    }
    const formalBonus = formalities.filter((f) => f === "formal" || f === "smart_casual").length * 5;
    return {
      score: Math.min(35, 25 + formalBonus),
      isValid: true,
      reasoning: "Smart architectural tailoring with crisp, professional presence.",
    };
  }

  if (occasion === "college") {
    if (hasFormal && formalities.length > 2) {
      return {
        score: 26,
        isValid: true,
        reasoning: "Elevated campus styling blending tailored structure with daily versatility.",
      };
    }
    return {
      score: 33,
      isValid: true,
      reasoning: "Relaxed campus silhouette prioritizing ease of movement and tactile comfort.",
    };
  }

  if (occasion === "dinner") {
    if (hasActivewear) {
      return {
        score: 5,
        isValid: false,
        reasoning: "Activewear is incompatible with dinner occasion.",
      };
    }
    return {
      score: 32,
      isValid: true,
      reasoning: "Elevated evening mood with refined proportions and understated luxury.",
    };
  }

  // Default / Casual
  return {
    score: 30,
    isValid: true,
    reasoning: "Effortless casual coordination tailored for comfortable daily rotation.",
  };
}

/**
 * Weather Suitability Evaluation (0 to 20 pts)
 */
export function evaluateWeatherSuitability(
  pieces: WardrobeItem[],
  weather: WeatherData | null
): { score: number; reasoning: string } {
  if (!weather) {
    return {
      score: 15,
      reasoning: "Weather context unconfigured; Timeless seasonal balance applied.",
    };
  }

  const temp = weather.temperature;
  const isRaining =
    weather.category === "rain" ||
    weather.category === "thunderstorm" ||
    (weather.precipitation !== undefined && weather.precipitation > 0);
  let score = 15;
  const notes: string[] = [];

  const hasOuterwear = pieces.some((p) => normalizeCategoryToRole(p.category, p.subCategory) === "outerwear");
  const hasShorts = pieces.some((p) => {
    const sub = (p.subCategory || "").toLowerCase();
    const name = (p.name || "").toLowerCase();
    return sub.includes("short") || name.includes("short");
  });
  const hasHeavyLayer = pieces.some((p) => {
    const name = (p.name || "").toLowerCase();
    const tags = (p.tags || []).map((t) => t.toLowerCase());
    return name.includes("overcoat") || name.includes("trench") || tags.includes("winter");
  });

  // Hot weather (> 25°C)
  if (temp > 25) {
    if (hasHeavyLayer) {
      score -= 10;
      notes.push(`Heavy outerwear penalised in warm heat (${temp}°C).`);
    } else {
      score += 2;
      notes.push(`Lightweight & breathable construction suited for warm climate (${temp}°C).`);
    }
  } else if (temp < 16) {
    // Cold weather (< 16°C)
    if (hasShorts) {
      score -= 10;
      notes.push(`Shorts discouraged in cool weather (${temp}°C).`);
    }
    if (hasOuterwear || hasHeavyLayer) {
      score += 2;
      notes.push(`Protective thermal layering suited for cool conditions (${temp}°C).`);
    } else {
      notes.push(`Light layering for ${temp}°C; outerwear recommended if evening cools.`);
    }
  } else {
    notes.push(`Versatile medium-weight layer ideal for temperate ${temp}°C conditions.`);
  }

  if (isRaining) {
    if (hasOuterwear) {
      score += 2;
      notes.push("Weather-resistant layer provides shelter against precipitation.");
    } else {
      notes.push("Rainy weather detected; consider carrying an umbrella or water-resistant layer.");
    }
  }

  return {
    score: Math.min(20, Math.max(5, score)),
    reasoning: notes.join(" "),
  };
}

/**
 * Deterministic Single Outfit Generator
 * Evaluates candidate pieces from the inventory, scores combinations, and returns the highest-scoring match.
 */
export function generateDeterministicOutfit(options: {
  inventory: WardrobeItem[];
  occasion?: OutfitOccasion;
  weather?: WeatherData | null;
  anchorItemId?: number;
  requiredItemIds?: number[];
  allowedRoles?: GarmentRole[];
  preferAlternativeStructures?: boolean;
}): OutfitRecommendationResult {
  const { inventory, occasion = "casual", weather = null, preferAlternativeStructures = false } = options;
  const anchorItemId = options.anchorItemId ?? options.requiredItemIds?.[0];

  if (inventory.length === 0) {
    return {
      success: false,
      error: "Your wardrobe is empty. Add garments to generate outfits.",
      reasonCode: "EMPTY_INVENTORY",
    };
  }

  // Filter to clean items only
  const cleanItems = inventory.filter(
    (item) => item.laundryStatus !== "in_wash" && (item as unknown as { inLaundry?: boolean }).inLaundry !== true
  );

  if (cleanItems.length === 0) {
    return {
      success: false,
      error: "Your wardrobe contains no clean garments. Wash garments or add new pieces to generate outfits.",
      reasonCode: "INSUFFICIENT_CLEAN_ITEMS",
    };
  }

  // Segment inventory by role
  const categorized: Record<GarmentRole, WardrobeItem[]> = {
    top: [],
    bottom: [],
    footwear: [],
    one_piece: [],
    outerwear: [],
    accessory: [],
  };

  cleanItems.forEach((item) => {
    const role = normalizeCategoryToRole(item.category, item.subCategory);
    categorized[role].push(item);
  });

  // Check if anchor item is requested
  const anchorItem = anchorItemId ? cleanItems.find((i) => i.id === anchorItemId) : undefined;
  const anchorRole = anchorItem ? normalizeCategoryToRole(anchorItem.category, anchorItem.subCategory) : undefined;

  // If occasion is gym, filter pools to activewear
  if (occasion === "gym") {
    const filterActive = (list: WardrobeItem[]) => list.filter((item) => getGarmentFormality(item) === "activewear");
    const activeTops = filterActive(categorized.top);
    const activeBottoms = filterActive(categorized.bottom);
    const activeShoes = filterActive(categorized.footwear);

    if (activeTops.length === 0 || activeBottoms.length === 0 || activeShoes.length === 0) {
      return {
        success: false,
        error: "Missing activewear pieces for Gym fit. At least one athletic top, bottom, and footwear are required.",
        reasonCode: "NO_ACTIVEWEAR_FOR_GYM",
      };
    }
  }

  // Determine possible outfit structures
  const hasOnePiece = categorized.one_piece.length > 0;
  const hasTopBottom = categorized.top.length > 0 && categorized.bottom.length > 0;
  const hasFootwear = categorized.footwear.length > 0;

  const totalFootwearInInventory = inventory.filter(
    (item) => normalizeCategoryToRole(item.category, item.subCategory) === "footwear"
  ).length;

  const missingFootwearReason: "absent" | "in_laundry" =
    totalFootwearInInventory > 0 ? "in_laundry" : "absent";

  const missingFootwearExplanation =
    missingFootwearReason === "in_laundry"
      ? "All footwear pieces are currently in laundry. Paired top & bottom without shoes."
      : "No footwear cataloged in your wardrobe yet. Paired top & bottom without shoes.";

  // If no footwear and no tops/bottoms or one-piece, return actionable error
  if (!hasFootwear && !hasTopBottom && !hasOnePiece) {
    return {
      success: false,
      error:
        missingFootwearReason === "in_laundry"
          ? "All footwear is in laundry, and you are missing matching tops or bottoms."
          : "Your wardrobe lacks matching tops and bottoms to assemble an outfit.",
      reasonCode: "MISSING_TOPS_OR_BOTTOMS",
    };
  }

  if (!hasOnePiece && !hasTopBottom) {
    return {
      success: false,
      error: "Insufficient wardrobe pieces: requires at least a clean top and bottom, or a one-piece dress.",
      reasonCode: "MISSING_TOPS_OR_BOTTOMS",
    };
  }

  // Generate candidate combinations
  interface CandidateOutfit {
    structure: "standard" | "one_piece" | "layered" | "partial_top_bottom";
    pieces: OutfitPieceAssignment[];
    top?: WardrobeItem;
    bottom?: WardrobeItem;
    footwear?: WardrobeItem;
    onePiece?: WardrobeItem;
    outerwear?: WardrobeItem;
    accessory?: WardrobeItem;
  }

  const candidates: CandidateOutfit[] = [];

  // 1. One-piece candidate structures
  if (hasOnePiece && (!anchorRole || anchorRole === "one_piece" || anchorRole === "footwear")) {
    const onePieces = anchorRole === "one_piece" && anchorItem ? [anchorItem] : categorized.one_piece;
    const shoes = anchorRole === "footwear" && anchorItem ? [anchorItem] : categorized.footwear;

    if (shoes.length > 0) {
      onePieces.forEach((dress) => {
        shoes.forEach((shoe) => {
          candidates.push({
            structure: "one_piece",
            onePiece: dress,
            footwear: shoe,
            pieces: [
              { role: "one_piece", item: dress },
              { role: "footwear", item: shoe },
            ],
          });
        });
      });
    } else {
      // Partial one-piece without footwear
      onePieces.forEach((dress) => {
        candidates.push({
          structure: "partial_top_bottom",
          onePiece: dress,
          pieces: [{ role: "one_piece", item: dress }],
        });
      });
    }
  }

  // 2. Standard 3-piece candidate structures (Top + Bottom + Footwear) OR Partial (Top + Bottom)
  if (hasTopBottom && (!anchorRole || anchorRole === "top" || anchorRole === "bottom" || anchorRole === "footwear")) {
    let tops = categorized.top;
    let bottoms = categorized.bottom;
    let shoes = categorized.footwear;

    if (anchorRole === "top" && anchorItem) tops = [anchorItem];
    if (anchorRole === "bottom" && anchorItem) bottoms = [anchorItem];
    if (anchorRole === "footwear" && anchorItem) shoes = [anchorItem];

    // If gym occasion, restrict candidates to activewear
    if (occasion === "gym") {
      tops = tops.filter((t) => getGarmentFormality(t) === "activewear");
      bottoms = bottoms.filter((b) => getGarmentFormality(b) === "activewear");
      shoes = shoes.filter((s) => getGarmentFormality(s) === "activewear");
    }

    if (shoes.length > 0) {
      tops.forEach((top) => {
        bottoms.forEach((bottom) => {
          shoes.forEach((shoe) => {
            candidates.push({
              structure: "standard",
              top,
              bottom,
              footwear: shoe,
              pieces: [
                { role: "top", item: top },
                { role: "bottom", item: bottom },
                { role: "footwear", item: shoe },
              ],
            });
          });
        });
      });
    } else {
      // Allow partial outfit when footwear is missing: Top + Bottom paired together
      tops.forEach((top) => {
        bottoms.forEach((bottom) => {
          candidates.push({
            structure: "partial_top_bottom",
            top,
            bottom,
            pieces: [
              { role: "top", item: top },
              { role: "bottom", item: bottom },
            ],
          });
        });
      });
    }
  }

  if (candidates.length === 0) {
    return {
      success: false,
      error: "Could not assemble an outfit matching the requested anchor item or occasion constraints.",
      reasonCode: "NO_VALID_COMBINATIONS",
    };
  }

  // Score each candidate outfit
  let bestCandidate: CuratedOutfit | null = null;
  let highestScore = -1;

  for (const candidate of candidates) {
    const pieceItems = candidate.pieces.map((p) => p.item);
    const colorFamilies = pieceItems.map((p) => mapColorToFamily(p.color));

    const colorEval = evaluateColorHarmony(colorFamilies);
    const formalityEval = evaluateFormalityMatch(pieceItems, occasion);
    const weatherEval = evaluateWeatherSuitability(pieceItems, weather);

    // Reject invalid formality/activewear mismatches
    if (!formalityEval.isValid) continue;

    // Bonus score for user favorites (0 to 10)
    const favoriteCount = pieceItems.filter((p) => p.favorite).length;
    const bonusScore = Math.min(10, favoriteCount * 4);
    const alternativeBonus = preferAlternativeStructures && candidate.structure === "one_piece" ? 2 : 0;

    const totalRaw = colorEval.score + formalityEval.score + weatherEval.score + bonusScore + alternativeBonus; // max 100
    const scaledScore = Math.round((totalRaw / 10) * 10) / 10; // 0.0 to 10.0 scale

    if (scaledScore > highestScore) {
      highestScore = scaledScore;

      const combinedReasoning = `${colorEval.reasoning} ${formalityEval.reasoning} ${weatherEval.reasoning}`.trim();
      const isPartial = candidate.structure === "partial_top_bottom" || !candidate.footwear;

      bestCandidate = {
        structure: candidate.structure,
        occasion,
        pieces: candidate.pieces,
        top: candidate.top,
        bottom: candidate.bottom,
        footwear: candidate.footwear,
        onePiece: candidate.onePiece,
        harmonyScore: scaledScore,
        harmonyPercentage: Math.min(100, Math.round(totalRaw)),
        breakdown: {
          colorScore: colorEval.score,
          formalityScore: formalityEval.score,
          weatherScore: weatherEval.score,
          bonusScore,
        },
        reasoning: isPartial
          ? `${combinedReasoning} (${missingFootwearExplanation})`
          : combinedReasoning,
        isPartial,
        missingCategory: isPartial ? "footwear" : undefined,
        missingReason: isPartial ? missingFootwearReason : undefined,
        missingExplanation: isPartial ? missingFootwearExplanation : undefined,
      };
    }
  }

  if (!bestCandidate) {
    return {
      success: false,
      error: "No compatible outfit combination satisfied formality and color harmony rules.",
      reasonCode: "NO_VALID_COMBINATIONS",
    };
  }

  return {
    success: true,
    outfit: bestCandidate,
    isPartial: bestCandidate.isPartial,
    reasonCode: bestCandidate.isPartial ? "PARTIAL_OUTFIT" : undefined,
    missingCategory: bestCandidate.missingCategory,
    missingReason: bestCandidate.missingReason,
  };
}

/**
 * Validates a returned outfit against the inventory to guarantee zero hallucinated IDs,
 * role adherence, and clean status.
 */
export function validateOutfitAgainstInventory(
  outfit: {
    topId?: number;
    bottomId?: number;
    footwearId?: number;
    onePieceId?: number;
    top?: WardrobeItem;
    bottom?: WardrobeItem;
    footwear?: WardrobeItem;
    onePiece?: WardrobeItem;
  },
  inventory: WardrobeItem[],
  occasion: OutfitOccasion = "casual"
): { isValid: boolean; error?: string; errors: string[]; verifiedItems?: WardrobeItem[] } {
  const topId = outfit.topId ?? outfit.top?.id;
  const bottomId = outfit.bottomId ?? outfit.bottom?.id;
  const footwearId = outfit.footwearId ?? outfit.footwear?.id;
  const onePieceId = outfit.onePieceId ?? outfit.onePiece?.id;

  const itemsById = new Map<number, WardrobeItem>();
  inventory.forEach((i) => {
    if (typeof i.id === "number") itemsById.set(i.id, i);
  });

  const verified: WardrobeItem[] = [];

  // Check One-Piece structure
  if (onePieceId) {
    const dress = itemsById.get(onePieceId);
    if (!dress) return { isValid: false, error: `Dress ID ${onePieceId} does not exist in inventory.`, errors: [`Dress ID ${onePieceId} does not exist.`] };
    if (dress.laundryStatus === "in_wash") return { isValid: false, error: `Dress '${dress.name}' is in laundry.`, errors: ["Dress is in laundry."] };
    verified.push(dress);

    if (!footwearId) return { isValid: false, error: "One-piece outfit requires footwearId.", errors: ["One-piece outfit requires footwearId."] };
    const shoe = itemsById.get(footwearId);
    if (!shoe) return { isValid: false, error: `Footwear ID ${footwearId} does not exist in inventory.`, errors: [`Footwear ID ${footwearId} does not exist.`] };
    if (shoe.laundryStatus === "in_wash") return { isValid: false, error: `Shoe '${shoe.name}' is in laundry.`, errors: ["Shoe is in laundry."] };
    verified.push(shoe);

    return { isValid: true, errors: [], verifiedItems: verified };
  }

  // Check 3-piece structure
  if (!topId || !bottomId || !footwearId) {
    return { isValid: false, error: "Standard outfit requires topId, bottomId, and footwearId.", errors: ["Missing required outfit pieces."] };
  }

  const top = itemsById.get(topId);
  if (!top) return { isValid: false, error: `Top ID ${topId} does not exist in inventory.`, errors: [`Top ID ${topId} does not exist.`] };
  if (top.laundryStatus === "in_wash") return { isValid: false, error: `Top '${top.name}' is in laundry.`, errors: ["Top is in laundry."] };

  const bottom = itemsById.get(bottomId);
  if (!bottom) return { isValid: false, error: `Bottom ID ${bottomId} does not exist in inventory.`, errors: [`Bottom ID ${bottomId} does not exist.`] };
  if (bottom.laundryStatus === "in_wash") return { isValid: false, error: `Bottom '${bottom.name}' is in laundry.`, errors: ["Bottom is in laundry."] };

  const shoe = itemsById.get(footwearId);
  if (!shoe) return { isValid: false, error: `Footwear ID ${footwearId} does not exist in inventory.`, errors: [`Footwear ID ${footwearId} does not exist.`] };
  if (shoe.laundryStatus === "in_wash") return { isValid: false, error: `Footwear '${shoe.name}' is in laundry.`, errors: ["Footwear is in laundry."] };

  // Check duplicate ID usage
  if (topId === bottomId || topId === footwearId || bottomId === footwearId) {
    return { isValid: false, error: "Duplicate item IDs assigned to multiple roles in the same outfit.", errors: ["Duplicate item IDs in outfit."] };
  }

  // Check gym occasion restrictions
  if (occasion === "gym") {
    if (getGarmentFormality(top) !== "activewear" || getGarmentFormality(bottom) !== "activewear" || getGarmentFormality(shoe) !== "activewear") {
      return { isValid: false, error: "Gym outfit must only consist of activewear-tagged items.", errors: ["Non-activewear pieces in gym outfit."] };
    }
  }

  return { isValid: true, errors: [], verifiedItems: [top, bottom, shoe] };
}

import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { WardrobeItem, DayOfWeek } from "@/lib/db";
import { WeatherData } from "@/lib/weather";
import {
  generateDeterministicOutfit,
  validateOutfitAgainstInventory,
  OutfitOccasion,
  CuratedOutfit,
} from "@/lib/outfit-engine";

function resolveApiKey(): string | undefined {
  const envKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;

  if (envKey && envKey.trim()) {
    return envKey.trim();
  }
  return undefined;
}

const ALL_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface DaySchedulePreference {
  occasion: OutfitOccasion;
  isRestDay?: boolean;
  includeSecondContext?: boolean;
  secondOccasion?: OutfitOccasion;
}

export type DaysScheduleConfig = Partial<Record<DayOfWeek, DaySchedulePreference>>;

export async function POST(req: NextRequest) {
  try {
    let body: {
      items?: WardrobeItem[];
      mode?: "single" | "schedule";
      occasion?: OutfitOccasion;
      anchorItemId?: number;
      scheduleConfig?: DaysScheduleConfig;
      weather?: WeatherData | null;
      complexion?: string | null;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const {
      items = [],
      mode = "schedule",
      occasion = "casual",
      anchorItemId,
      scheduleConfig,
      complexion = null,
    } = body;

    const weather = body.weather && typeof body.weather === "object" && "temperature" in body.weather
      ? (body.weather as WeatherData)
      : null;

    // Filter to clean items only
    const cleanItems = items.filter(
      (item) =>
        item.laundryStatus !== "in_wash" &&
        (item as unknown as { inLaundry?: boolean }).inLaundry !== true
    );

    if (cleanItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Your wardrobe contains no clean garments. Wash garments or add new pieces to generate outfits.",
          reasonCode: "INSUFFICIENT_CLEAN_ITEMS",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------
    // MODE 1: SINGLE OUTFIT GENERATION (e.g. for a specific day or style lab)
    // -------------------------------------------------------------
    if (mode === "single") {
      const result = generateDeterministicOutfit({
        inventory: cleanItems,
        occasion,
        weather,
        anchorItemId,
      });

      if (!result.success || !result.outfit) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "No valid outfit combination could be generated from available pieces.",
            reasonCode: result.reasonCode || "NO_VALID_COMBINATIONS",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        source: "deterministic-engine",
        outfit: result.outfit,
      });
    }

    // -------------------------------------------------------------
    // MODE 2: CUSTOM WEEKLY SCHEDULE CURATION
    // -------------------------------------------------------------
    const defaultScheduleConfig: DaysScheduleConfig = {
      Mon: { occasion: "college" },
      Tue: { occasion: "casual" },
      Wed: { occasion: "work" },
      Thu: { occasion: "casual" },
      Fri: { occasion: "dinner" },
      Sat: { occasion: "outing" },
      Sun: { occasion: "rest", isRestDay: true },
    };

    const activeConfig: DaysScheduleConfig = {
      ...defaultScheduleConfig,
      ...(scheduleConfig || {}),
    };

    // Build deterministic baseline schedule
    const scheduleResult: Record<
      DayOfWeek,
      {
        primary?: CuratedOutfit;
        secondary?: CuratedOutfit;
        isRestDay?: boolean;
        occasion?: OutfitOccasion;
      }
    > = {
      Mon: {},
      Tue: {},
      Wed: {},
      Thu: {},
      Fri: {},
      Sat: {},
      Sun: {},
    };

    for (const day of ALL_DAYS) {
      const dayPref = activeConfig[day] || { occasion: "casual" };
      if (dayPref.isRestDay || dayPref.occasion === "rest") {
        scheduleResult[day] = {
          isRestDay: true,
          occasion: "rest",
        };
        continue;
      }

      // Generate Primary Outfit for the day's selected occasion
      const primaryRes = generateDeterministicOutfit({
        inventory: cleanItems,
        occasion: dayPref.occasion,
        weather,
      });

      scheduleResult[day] = {
        isRestDay: false,
        occasion: dayPref.occasion,
        primary: primaryRes.outfit,
      };

      // Optional secondary context (e.g., Gym or Evening) if enabled
      if (dayPref.includeSecondContext && dayPref.secondOccasion) {
        const secRes = generateDeterministicOutfit({
          inventory: cleanItems,
          occasion: dayPref.secondOccasion,
          weather,
        });
        if (secRes.success && secRes.outfit) {
          scheduleResult[day].secondary = secRes.outfit;
        }
      }
    }

    const apiKey = resolveApiKey();

    // If Gemini API key is missing, return the deterministic schedule directly
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        source: "deterministic-engine",
        schedule: scheduleResult,
      });
    }

    // -------------------------------------------------------------
    // OPTIONAL: ENHANCE WITH GEMINI INTELLIGENCE WHEN KEY IS AVAILABLE
    // -------------------------------------------------------------
    try {
      const ai = new GoogleGenAI({ apiKey });
      const targetModel = (process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();

      const inventorySummary = cleanItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        subCategory: item.subCategory || "",
        color: item.color,
        brand: item.brand || "",
        tags: item.tags || [],
      }));

      let weatherSection = "Weather Context: Unspecified. Optimize for aesthetic harmony and season.";
      if (weather) {
        weatherSection = `Current Weather Context: ${weather.summary} (${weather.temperature}°C, ${weather.condition}). Select breathable fabrics if hot, protective layers if cold or raining.`;
      }

      let complexionSection = "User Complexion: Unspecified. Use balanced palette harmony.";
      if (complexion && complexion.trim()) {
        complexionSection = `User Skin Tone: ${complexion.trim()}. Flatter this tone with complementary palettes.`;
      }

      const schedulePromptOverview = ALL_DAYS.map((day) => {
        const pref = activeConfig[day] || { occasion: "casual" };
        if (pref.isRestDay) return `${day}: Rest Day (No outfit needed)`;
        return `${day}: Occasion: ${pref.occasion}`;
      }).join("\n");

      const prompt = `You are a quiet-luxury wardrobe stylist for fashion app 'Drippy'.
Curate outfits for this user's custom schedule using ONLY real garments from their inventory.

CONTEXT:
${complexionSection}
${weatherSection}

WEEKLY SCHEDULE REQUIREMENTS:
${schedulePromptOverview}

INVENTORY:
${JSON.stringify(inventorySummary, null, 2)}

STRICT RULES:
1. ONLY use garment IDs that exist in the INVENTORY.
2. For each scheduled day, provide:
   - topId: ID of a top (or leave null if dress/one-piece is used)
   - bottomId: ID of a bottom (or leave null if dress/one-piece is used)
   - footwearId: ID of a shoe/footwear (REQUIRED)
   - onePieceId: ID of a dress (if using dress instead of top+bottom)
   - harmonyScore: number between 1.0 and 10.0
   - reasoning: explanation of why this outfit suits the occasion and climate.
3. If occasion is 'gym', ONLY pick items with activewear/gym tags.
4. If a day is marked Rest Day, return null for that day.`;

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: Type.OBJECT,
            properties: {
              schedule: {
                type: Type.OBJECT,
                properties: {
                  Mon: { type: Type.OBJECT, properties: { topId: { type: Type.INTEGER }, bottomId: { type: Type.INTEGER }, footwearId: { type: Type.INTEGER }, onePieceId: { type: Type.INTEGER }, harmonyScore: { type: Type.NUMBER }, reasoning: { type: Type.STRING } } },
                  Tue: { type: Type.OBJECT, properties: { topId: { type: Type.INTEGER }, bottomId: { type: Type.INTEGER }, footwearId: { type: Type.INTEGER }, onePieceId: { type: Type.INTEGER }, harmonyScore: { type: Type.NUMBER }, reasoning: { type: Type.STRING } } },
                  Wed: { type: Type.OBJECT, properties: { topId: { type: Type.INTEGER }, bottomId: { type: Type.INTEGER }, footwearId: { type: Type.INTEGER }, onePieceId: { type: Type.INTEGER }, harmonyScore: { type: Type.NUMBER }, reasoning: { type: Type.STRING } } },
                  Thu: { type: Type.OBJECT, properties: { topId: { type: Type.INTEGER }, bottomId: { type: Type.INTEGER }, footwearId: { type: Type.INTEGER }, onePieceId: { type: Type.INTEGER }, harmonyScore: { type: Type.NUMBER }, reasoning: { type: Type.STRING } } },
                  Fri: { type: Type.OBJECT, properties: { topId: { type: Type.INTEGER }, bottomId: { type: Type.INTEGER }, footwearId: { type: Type.INTEGER }, onePieceId: { type: Type.INTEGER }, harmonyScore: { type: Type.NUMBER }, reasoning: { type: Type.STRING } } },
                  Sat: { type: Type.OBJECT, properties: { topId: { type: Type.INTEGER }, bottomId: { type: Type.INTEGER }, footwearId: { type: Type.INTEGER }, onePieceId: { type: Type.INTEGER }, harmonyScore: { type: Type.NUMBER }, reasoning: { type: Type.STRING } } },
                  Sun: { type: Type.OBJECT, properties: { topId: { type: Type.INTEGER }, bottomId: { type: Type.INTEGER }, footwearId: { type: Type.INTEGER }, onePieceId: { type: Type.INTEGER }, harmonyScore: { type: Type.NUMBER }, reasoning: { type: Type.STRING } } },
                },
              },
            },
          },
        },
      });

      const responseText = response.text;
      if (responseText) {
        const parsed = JSON.parse(responseText);
        const aiSchedule = parsed.schedule;

        // Strictly validate each AI generated day against inventory
        for (const day of ALL_DAYS) {
          const aiDay = aiSchedule?.[day];
          const pref = activeConfig[day] || { occasion: "casual" };

          if (aiDay && !pref.isRestDay) {
            const validation = validateOutfitAgainstInventory(aiDay, cleanItems, pref.occasion);
            if (validation.isValid && validation.verifiedItems) {
              const top = cleanItems.find((i) => i.id === aiDay.topId);
              const bottom = cleanItems.find((i) => i.id === aiDay.bottomId);
              const footwear = cleanItems.find((i) => i.id === aiDay.footwearId);
              const onePiece = cleanItems.find((i) => i.id === aiDay.onePieceId);

              scheduleResult[day].primary = {
                structure: onePiece ? "one_piece" : "standard",
                occasion: pref.occasion,
                top,
                bottom,
                footwear,
                onePiece,
                pieces: validation.verifiedItems.map((item) => ({
                  role: item.id === aiDay.topId ? "top" : item.id === aiDay.bottomId ? "bottom" : item.id === aiDay.onePieceId ? "one_piece" : "footwear",
                  item,
                })),
                harmonyScore: Math.round(Number(aiDay.harmonyScore || 8.5) * 10) / 10,
                harmonyPercentage: Math.round(Number(aiDay.harmonyScore || 8.5) * 10),
                breakdown: {
                  colorScore: 30,
                  formalityScore: 30,
                  weatherScore: 18,
                  bonusScore: 7,
                },
                reasoning: String(aiDay.reasoning || "Neural curated harmonious silhouette.").trim(),
              };
            }
          }
        }

        return NextResponse.json({
          success: true,
          source: "gemini-validated",
          schedule: scheduleResult,
        });
      }
    } catch (aiErr) {
      console.warn("[Curate API] Gemini generation failed or returned invalid IDs, relying on deterministic schedule:", aiErr);
    }

    // Return deterministic schedule on AI failure or missing output
    return NextResponse.json({
      success: true,
      source: "deterministic-engine",
      schedule: scheduleResult,
    });
  } catch (error: unknown) {
    console.error("[Curate API] Unhandled error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to curate outfits.",
      },
      { status: 500 }
    );
  }
}

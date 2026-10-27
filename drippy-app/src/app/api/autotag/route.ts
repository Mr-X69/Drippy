import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { ALLOWED_COLORS } from "@/lib/colors";
import { extractGeminiError } from "@/lib/gemini-errors";

// Helper to retrieve API key from standard environment variables
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

export async function POST(req: NextRequest) {
  let body: { image?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload in request body" },
      { status: 400 }
    );
  }

  const { image } = body;

  if (!image || typeof image !== "string" || !image.trim()) {
    return NextResponse.json(
      { error: "Missing or invalid base64 image data" },
      { status: 400 }
    );
  }

  // Parse data URL and clean base64 payload
  let mimeType = "image/jpeg";
  let base64Data = image;

  if (image.includes(";base64,")) {
    const parts = image.split(";base64,");
    mimeType = parts[0].replace(/^data:/, "").trim().toLowerCase() || "image/jpeg";
    base64Data = parts[1] || "";
  }

  if (mimeType === "image/jpg") {
    mimeType = "image/jpeg";
  }

  // Strip whitespace, carriage returns, and line feeds
  base64Data = base64Data.trim().replace(/[\r\n\s]+/g, "");

  if (!base64Data) {
    return NextResponse.json(
      { error: "Empty base64 image content" },
      { status: 400 }
    );
  }

  const apiKey = resolveApiKey();

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "No Gemini API key configured. Please set GEMINI_API_KEY in .env.local",
      },
      { status: 500 }
    );
  }

  // Target model normalization
  let targetModel = (process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();
  if (
    targetModel === "gemini-2.5-flash" ||
    targetModel === "gemini-1.5-flash-latest" ||
    targetModel === "gemini-2.0-flash"
  ) {
    targetModel = "gemini-3.8-flash";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt =
      `Analyze this clothing item image. Extract the garment name, category (strictly Top, Bottom, Outerwear, Footwear, or Accessory), sub-category (e.g., Oversized Tee, Cargo Pants, Hoodie), primary color tone, and recommended college occasions (College Casual, Presentation / Formal, Fest / Traditional, Lab Day).\n\nIMPORTANT FOR COLOR: You MUST strictly select the primary color tone from ONLY this exact list of predefined colors: [${ALLOWED_COLORS.join(", ")}]. Do not invent or return any other color outside this exact list. Choose the closest match from this list.`;

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "Editorial, clean garment name (e.g., Oversized Heavyweight Tee, Pleated Wool Trousers)",
            },
            category: {
              type: Type.STRING,
              enum: ["Top", "Bottom", "Outerwear", "Footwear", "Accessory"],
              description: "Strictly one of: Top, Bottom, Outerwear, Footwear, Accessory",
            },
            subCategory: {
              type: Type.STRING,
              description: "Specific sub-category (e.g., Oversized Tee, Cargo Pants, Derby Shoes, Knitwear)",
            },
            color: {
              type: Type.STRING,
              enum: [...ALLOWED_COLORS],
              description: `Primary clothing color tone. Must strictly be one of: ${ALLOWED_COLORS.join(", ")}`,
            },
            occasions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "One or more suitable occasions from: College Casual, Presentation / Formal, Fest / Traditional, Lab Day",
            },
          },
          propertyOrdering: ["name", "category", "subCategory", "color", "occasions"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return NextResponse.json(
        { error: "Empty response returned from Gemini Vision" },
        { status: 502 }
      );
    }

    let parsed: {
      name?: string;
      category?: string;
      subCategory?: string;
      color?: string;
      occasions?: string[];
    };

    try {
      parsed = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse structured response from Gemini" },
        { status: 502 }
      );
    }

    // Ensure color strictly normalizes to one of the allowed colors
    let resolvedColor: string = "Olive";
    if (parsed.color && typeof parsed.color === "string") {
      const cleanColor = parsed.color.trim();
      const exactMatch = ALLOWED_COLORS.find(
        (c) => c.toLowerCase() === cleanColor.toLowerCase()
      );
      if (exactMatch) {
        resolvedColor = exactMatch;
      } else {
        const partialMatch = ALLOWED_COLORS.find(
          (c) =>
            cleanColor.toLowerCase().includes(c.toLowerCase()) ||
            c.toLowerCase().includes(cleanColor.toLowerCase())
        );
        if (partialMatch) {
          resolvedColor = partialMatch;
        }
      }
    }

    return NextResponse.json({
      name: parsed.name?.trim() || "Curated Garment",
      category: parsed.category || "Top",
      subCategory: parsed.subCategory || "Garment",
      color: resolvedColor,
      occasions:
        Array.isArray(parsed.occasions) && parsed.occasions.length > 0
          ? parsed.occasions
          : ["College Casual"],
    });
  } catch (err: unknown) {
    const { status, message } = extractGeminiError(err);
    console.error(`Gemini autotag error [${status}]:`, message);
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

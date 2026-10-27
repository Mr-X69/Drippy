import { NextRequest, NextResponse } from "next/server";
import { Client, handle_file } from "@gradio/client";
import os from "os";
import path from "path";
import fs from "fs";

// Default public Hugging Face space for IDM-VTON
const DEFAULT_VTON_SPACE = "yisol/IDM-VTON";

interface ProcessedFile {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  file: any;
  cleanup?: () => void;
}

/**
 * Normalizes an image input (URL or base64 data URL) into a Gradio-compatible file handle.
 * For base64 inputs, writes to a temporary file in os.tmpdir() to allow Gradio Client's
 * Node upload command to handle the payload efficiently.
 */
function processInputToGradioFile(input: string, prefix = "vton"): ProcessedFile {
  const trimmed = input.trim();

  // If it's a web URL, handle directly
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return {
      file: handle_file(trimmed),
    };
  }

  // Handle base64 / data URL
  let base64 = trimmed;
  let ext = "jpg";

  if (trimmed.includes(";base64,")) {
    const parts = trimmed.split(";base64,");
    if (parts[0].includes("png")) ext = "png";
    else if (parts[0].includes("webp")) ext = "webp";
    base64 = parts[1];
  }

  // Strip whitespace / newlines
  base64 = base64.replace(/[\r\n\s]+/g, "");

  const tmpFilename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const tmpFilePath = path.join(os.tmpdir(), tmpFilename);

  fs.writeFileSync(tmpFilePath, Buffer.from(base64, "base64"));

  return {
    file: handle_file(tmpFilePath),
    cleanup: () => {
      try {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
      } catch (err) {
        console.warn("Failed to delete temp file:", tmpFilePath, err);
      }
    },
  };
}

export async function POST(req: NextRequest) {
  const cleanups: (() => void)[] = [];

  try {
    let body: {
      baseImage?: unknown;
      garmentImage?: unknown;
      garmentDescription?: unknown;
      denoiseSteps?: unknown;
      seed?: unknown;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request payload." },
        { status: 400 }
      );
    }

    const { baseImage, garmentImage, garmentDescription, denoiseSteps, seed } = body;

    if (!baseImage || typeof baseImage !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid baseImage (human photo)." },
        { status: 400 }
      );
    }

    if (!garmentImage || typeof garmentImage !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid garmentImage." },
        { status: 400 }
      );
    }

    // Prepare human & garment file handles
    const humanProcessed = processInputToGradioFile(baseImage, "human");
    if (humanProcessed.cleanup) cleanups.push(humanProcessed.cleanup);

    const garmentProcessed = processInputToGradioFile(garmentImage, "garment");
    if (garmentProcessed.cleanup) cleanups.push(garmentProcessed.cleanup);

    const spaceId = process.env.VTON_SPACE_ID?.trim() || DEFAULT_VTON_SPACE;
    const hfToken = process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_TOKEN?.trim();

    console.log(`[VTON API] Connecting to Hugging Face Space: ${spaceId}...`);

    // Connect to Gradio Client
    const client = await Client.connect(
      spaceId,
      hfToken ? { hf_token: hfToken as `hf_${string}` } : undefined
    );

    const description =
      typeof garmentDescription === "string" && garmentDescription.trim()
        ? garmentDescription.trim()
        : "Contemporary editorial fashion garment, clean drape, high resolution";

    const steps = typeof denoiseSteps === "number" && denoiseSteps > 0 ? denoiseSteps : 30;
    const rngSeed = typeof seed === "number" ? seed : 42;

    console.log("[VTON API] Submitting prediction to /tryon...");

    // IDM-VTON /tryon endpoint parameters:
    // 1. dict: { background: humanFile, layers: [], composite: null }
    // 2. garm_img: garmentFile
    // 3. garment_des: string
    // 4. is_checked: boolean (auto-masking = true)
    // 5. is_checked_crop: boolean (auto-crop = false)
    // 6. denoise_steps: number (30)
    // 7. seed: number (42)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await client.predict("/tryon", [
      {
        background: humanProcessed.file,
        layers: [],
        composite: null,
      },
      garmentProcessed.file,
      description,
      true, // auto-masking enabled
      false, // keep natural framing
      steps,
      rngSeed,
    ]);

    // Parse the output image from result
    let outputUrl = "";
    if (result && Array.isArray(result.data) && result.data.length > 0) {
      const first = result.data[0];
      if (typeof first === "string") {
        outputUrl = first;
      } else if (first && typeof first === "object") {
        outputUrl = first.url || first.path || "";
      }
    }

    if (!outputUrl) {
      throw new Error("IDM-VTON did not return an output image in the expected format.");
    }

    console.log("[VTON API] Prediction successful:", outputUrl);

    return NextResponse.json({
      success: true,
      outputUrl,
      pipeline: "Hugging Face IDM-VTON",
      spaceId,
    });
  } catch (err: unknown) {
    console.error("[VTON API] Error during try-on prediction:", err);

    const errorMessage =
      err instanceof Error ? err.message : "Failed to generate virtual try-on.";

    // Graceful response for client UX: provide friendly failure notice
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        pipeline: "Hugging Face IDM-VTON",
        hint:
          "Public Hugging Face spaces may experience high queue load. Ensure network connectivity or configure an HF_TOKEN in .env.local for zero-queue processing.",
      },
      { status: 500 }
    );
  } finally {
    // Clean up any temp files
    for (const cleanup of cleanups) {
      cleanup();
    }
  }
}

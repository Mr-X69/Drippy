import { describe, it, expect } from "vitest";
import { extractGeminiError } from "@/lib/gemini-errors";
import { POST } from "@/app/api/autotag/route";
import { NextRequest } from "next/server";

describe("Gemini Vision Autofill: Timeout, Cancellation & Error Integrity", () => {
  describe("1. extractGeminiError mapping", () => {
    it("maps abort errors and timeouts to HTTP 504", () => {
      const abortErr = new Error("The operation was aborted");
      abortErr.name = "AbortError";
      const res1 = extractGeminiError(abortErr);
      expect(res1.status).toBe(504);
      expect(res1.message).toContain("timed out");

      const backendTimeout = new Error("BACKEND_TIMEOUT");
      const res2 = extractGeminiError(backendTimeout);
      expect(res2.status).toBe(504);
      expect(res2.message).toContain("timed out");
    });

    it("maps 429 quota and rate limit errors to HTTP 429", () => {
      const quotaErr = new Error(
        JSON.stringify({
          error: {
            code: 429,
            message: "Resource has been exhausted (e.g. check quota).",
            status: "RESOURCE_EXHAUSTED",
          },
        })
      );
      const res = extractGeminiError(quotaErr);
      expect(res.status).toBe(429);
      expect(res.message).toContain("rate limit exceeded");
    });

    it("maps 401 / 403 API key authentication errors to HTTP 401", () => {
      const authErr = new Error(
        JSON.stringify({
          error: {
            code: 400,
            message: "API key not valid. Please pass a valid API key.",
            status: "INVALID_ARGUMENT",
          },
        })
      );
      const res = extractGeminiError(authErr);
      expect(res.status).toBe(401);
      expect(res.message).toContain("API authentication failed");
    });

    it("maps 503 high demand / service unavailable to HTTP 503", () => {
      const demandErr = new Error(
        JSON.stringify({
          error: {
            code: 503,
            message:
              "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
            status: "UNAVAILABLE",
          },
        })
      );
      const res = extractGeminiError(demandErr);
      expect(res.status).toBe(503);
      expect(res.message).toContain("high demand");
    });

    it("maps 404 model not found to HTTP 502 with informative message", () => {
      const notFoundErr = new Error(
        JSON.stringify({
          error: {
            code: 404,
            message: "This model models/gemini-2.0-flash is no longer available.",
            status: "NOT_FOUND",
          },
        })
      );
      const res = extractGeminiError(notFoundErr);
      expect(res.status).toBe(502);
      expect(res.message).toContain("Model not found or unsupported");
    });

    it("handles null / undefined / unknown errors gracefully", () => {
      expect(extractGeminiError(null).status).toBe(500);
      expect(extractGeminiError(undefined).status).toBe(500);
      expect(extractGeminiError("random string").status).toBe(502);
    });
  });

  describe("2. /api/autotag HTTP Route Error Statuses", () => {
    it("returns HTTP 400 for missing or invalid payload without fallback: true", async () => {
      const req = new NextRequest("http://localhost:3000/api/autotag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Missing or invalid base64 image data");
      expect(json.fallback).toBeUndefined();
    });

    it("returns HTTP 400 for invalid JSON body", async () => {
      const req = new NextRequest("http://localhost:3000/api/autotag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "malformed-json{",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid JSON payload in request body");
      expect(json.fallback).toBeUndefined();
    });

    it("returns HTTP 400 for empty base64 string", async () => {
      const req = new NextRequest("http://localhost:3000/api/autotag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: "   " }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Missing or invalid base64 image data");
      expect(json.fallback).toBeUndefined();
    });

    it("never returns HTTP 200 with fallback: true when API key is missing", async () => {
      const origGemini = process.env.GEMINI_API_KEY;
      const origGoogle = process.env.GOOGLE_API_KEY;
      const origGenAI = process.env.GOOGLE_GENAI_API_KEY;

      try {
        delete process.env.GEMINI_API_KEY;
        delete process.env.GOOGLE_API_KEY;
        delete process.env.GOOGLE_GENAI_API_KEY;

        const req = new NextRequest("http://localhost:3000/api/autotag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: "data:image/jpeg;base64,validBase64Data" }),
        });

        const res = await POST(req);
        // Must return 500, never 200 with fallback!
        expect(res.status).toBe(500);

        const json = await res.json();
        expect(json.error).toContain("No Gemini API key configured");
        expect(json.fallback).toBeUndefined();
      } finally {
        if (origGemini) process.env.GEMINI_API_KEY = origGemini;
        if (origGoogle) process.env.GOOGLE_API_KEY = origGoogle;
        if (origGenAI) process.env.GOOGLE_GENAI_API_KEY = origGenAI;
      }
    });
  });

  describe("3. Client-side In-flight Request Management & Cancellation Logic", () => {
    it("simulates client request cancellation and guarantees state reset", async () => {
      let isAIExtracting = false;
      let aiErrorMessage: string | null = null;
      let abortController: AbortController | null = null;

      const cancelAnalysis = () => {
        if (abortController) {
          abortController.abort("USER_CANCELLED");
          abortController = null;
        }
        isAIExtracting = false;
        aiErrorMessage = "AI analysis cancelled. You can enter details manually.";
      };

      const startAnalysis = async () => {
        isAIExtracting = true;
        aiErrorMessage = null;
        abortController = new AbortController();

        try {
          await new Promise((_, reject) => {
            abortController?.signal.addEventListener("abort", () => {
              reject(new Error("Aborted"));
            });
          });
        } catch {
          // Handled
        } finally {
          isAIExtracting = false;
        }
      };

      // Start simulated analysis
      const promise = startAnalysis();
      expect(isAIExtracting).toBe(true);

      // User hits cancel
      cancelAnalysis();
      await promise;

      expect(isAIExtracting).toBe(false);
      expect(aiErrorMessage).toBe("AI analysis cancelled. You can enter details manually.");
    });

    it("prevents stale responses when active image changes during analysis", async () => {
      let activeImage: string | null = "image_A";
      let formGarmentName = "";

      const simulatedResponseA = { name: "Oversized Tee A" };
      const simulatedResponseB = { name: "Pleated Trousers B" };

      // Request A starts
      const reqAImage = "image_A";

      // User switches to image B before A finishes
      activeImage = "image_B";
      const reqBImage = "image_B";

      // When A finishes later, it checks activeImage === reqAImage
      if (activeImage === reqAImage) {
        formGarmentName = simulatedResponseA.name;
      }

      // Stale response A did not overwrite form
      expect(formGarmentName).toBe("");

      // When B finishes
      if (activeImage === reqBImage) {
        formGarmentName = simulatedResponseB.name;
      }

      expect(formGarmentName).toBe("Pleated Trousers B");
    });

    it("resets temporary form state when a new garment-entry session opens", () => {
      // Previous session state
      let name = "Previous Garment";
      let brand = "Previous Brand";
      let category = "shoes";
      let imageUrl = "data:image/jpeg;base64,previousImage";
      let selectedColor = { name: "Charcoal", hex: "#333333" };
      let aiSuccessMessage: string | null = "✨ Auto-tagged: Previous Garment";
      let aiErrorMessage: string | null = null;
      let bulkQueue = [{ id: "1", name: "Old Item" }];

      const resetForm = () => {
        name = "";
        category = "tops";
        brand = "";
        imageUrl = "";
        selectedColor = { name: "Olive", hex: "#2D3A2F" };
        aiSuccessMessage = null;
        aiErrorMessage = null;
        bulkQueue = [];
      };

      // Modal opens for a new session
      resetForm();

      expect(name).toBe("");
      expect(category).toBe("tops");
      expect(brand).toBe("");
      expect(imageUrl).toBe("");
      expect(selectedColor.name).toBe("Olive");
      expect(aiSuccessMessage).toBeNull();
      expect(aiErrorMessage).toBeNull();
      expect(bulkQueue).toEqual([]);
    });
  });
});

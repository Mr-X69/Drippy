export interface ExtractedGeminiError {
  status: number;
  message: string;
}

/**
 * Extracts a normalized HTTP status code and user-readable error message
 * from errors produced by @google/genai or fetch timeouts.
 */
export function extractGeminiError(err: unknown): ExtractedGeminiError {
  if (!err) {
    return { status: 500, message: "Unknown error during AI analysis" };
  }

  if (err instanceof Error) {
    if (
      err.name === "AbortError" ||
      err.message === "BACKEND_TIMEOUT" ||
      err.message.toLowerCase().includes("timeout")
    ) {
      return {
        status: 504,
        message: "Garment analysis timed out on server. Please try again.",
      };
    }
  }

  const anyErr = err as Record<string, unknown>;
  let statusCode = typeof anyErr.status === "number" ? anyErr.status : 502;
  let rawMessage = err instanceof Error ? err.message : String(err);

  // Parse nested JSON in error message (e.g. {"error":{"code":503,"message":"..."}})
  try {
    const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error) {
        if (typeof parsed.error.code === "number") {
          statusCode = parsed.error.code;
        }
        if (parsed.error.message && typeof parsed.error.message === "string") {
          rawMessage = parsed.error.message;
        }
      }
    }
  } catch {
    // Keep rawMessage
  }

  const lowerMsg = rawMessage.toLowerCase();

  if (
    statusCode === 429 ||
    lowerMsg.includes("quota") ||
    lowerMsg.includes("rate limit") ||
    lowerMsg.includes("resource_exhausted")
  ) {
    return {
      status: 429,
      message: "Gemini rate limit exceeded. Please wait a moment and try again.",
    };
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    lowerMsg.includes("api key") ||
    lowerMsg.includes("unauthenticated") ||
    lowerMsg.includes("permission_denied")
  ) {
    return {
      status: 401,
      message: "Gemini API authentication failed. Please verify your GEMINI_API_KEY.",
    };
  }

  if (
    statusCode === 503 ||
    lowerMsg.includes("unavailable") ||
    lowerMsg.includes("high demand") ||
    lowerMsg.includes("spikes in demand")
  ) {
    return {
      status: 503,
      message:
        rawMessage ||
        "Gemini is currently experiencing high demand. Please try again in a moment.",
    };
  }

  if (statusCode === 404 || lowerMsg.includes("not found")) {
    return {
      status: 502,
      message: `Model not found or unsupported: ${rawMessage}`,
    };
  }

  if (statusCode === 504 || lowerMsg.includes("deadline")) {
    return {
      status: 504,
      message: "Garment analysis timed out on server. Please try again.",
    };
  }

  const finalStatus = statusCode >= 400 && statusCode < 600 ? statusCode : 502;
  return {
    status: finalStatus,
    message: rawMessage || "Failed to analyze garment with Gemini",
  };
}

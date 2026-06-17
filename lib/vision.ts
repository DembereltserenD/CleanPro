// ============================================================
// lib/vision.ts
// Sends the sofa photo to a vision model and forces structured JSON.
// The model ONLY describes the sofa. It does not set prices.
// ============================================================
import Anthropic from "@anthropic-ai/sdk";
import type { Analysis } from "./estimate";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM = `You are a sofa-inspection assistant for a cleaning company.
Look at the photo and describe the sofa for pricing purposes.
Respond with ONLY a JSON object, no prose, no markdown fences:
{
  "material": "fabric" | "leather" | "suede" | "microfiber" | "unknown",
  "seats": <integer number of seats, 1-5; use 5 for 5 or more>,
  "stain_level": "none" | "light" | "moderate" | "heavy",
  "confidence": <number 0..1, how sure you are about material+seats+stain>,
  "description": "<one short sentence>"
}
If the image is not a sofa, or is too unclear, set material to "unknown" and confidence below 0.5.`;

export async function analyzeSofa(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp"
): Promise<Analysis> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: "Analyze this sofa. Return only the JSON." },
        ],
      },
    ],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const cleaned = text.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      material: parsed.material ?? "unknown",
      seats: Number(parsed.seats) || 3,
      stain_level: parsed.stain_level ?? "none",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      description: parsed.description ?? "",
    };
  } catch {
    // If parsing fails, force manual review.
    return { material: "unknown", seats: 3, stain_level: "none", confidence: 0, description: "parse_failed" };
  }
}

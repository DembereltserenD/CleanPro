// ============================================================
// app/api/leads/route.ts
// POST: create a lead. Accepts multipart/form-data:
//   phone, address, note?, photo (file)
// Flow: validate -> upload photo -> AI analyze -> price -> insert -> notify
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, PHOTO_BUCKET } from "../../../lib/supabase";
import { analyzeSofa } from "../../../lib/vision";
import { buildEstimate } from "../../../lib/estimate";
import { notify } from "../../../lib/notify";

export const runtime = "nodejs";
export const maxDuration = 30; // vision call can take a few seconds

// crude in-memory rate limit (per warm instance). For real use, back this with
// Upstash/Redis or a Supabase counter — see notes in README.
const hits = new Map<string, { c: number; t: number }>();
function rateLimited(ip: string) {
  const now = Date.now();
  const win = 60_000; // 1 min
  const max = 5;
  const e = hits.get(ip);
  if (!e || now - e.t > win) { hits.set(ip, { c: 1, t: now }); return false; }
  e.c++;
  return e.c > max;
}

function validPhone(p: string) {
  // Mongolia: 8 digits, optionally +976. Loosen/tighten as needed.
  return /^(\+?976)?\s?\d{8}$/.test(p.replace(/[\s-]/g, ""));
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const phone = String(form.get("phone") ?? "").trim();
  const address = String(form.get("address") ?? "").trim();
  const note = String(form.get("note") ?? "").trim() || null;
  const photo = form.get("photo") as File | null;

  if (!validPhone(phone)) return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
  if (address.length < 5) return NextResponse.json({ error: "Address is too short." }, { status: 400 });
  if (!photo) return NextResponse.json({ error: "Photo is required." }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/webp"] as const;
  if (!allowed.includes(photo.type as any)) {
    return NextResponse.json({ error: "Photo must be JPEG, PNG, or WEBP." }, { status: 400 });
  }
  if (photo.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo too large (max 8MB)." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const bytes = Buffer.from(await photo.arrayBuffer());

  // 1) upload photo to private storage
  const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
  const photoPath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const up = await db.storage.from(PHOTO_BUCKET).upload(photoPath, bytes, {
    contentType: photo.type,
    upsert: false,
  });
  if (up.error) {
    return NextResponse.json({ error: "Photo upload failed." }, { status: 500 });
  }

  // 2) AI analysis
  const analysis = await analyzeSofa(bytes.toString("base64"), photo.type as any);

  // 3) pricing decision
  const est = buildEstimate(analysis);
  const isInstant = est.mode === "instant";

  // 4) insert lead
  const { data: lead, error } = await db
    .from("leads")
    .insert({
      phone,
      address,
      note,
      photo_path: photoPath,
      ai_analysis: analysis,
      quote_mode: est.mode,
      estimate_min: isInstant ? est.min : null,
      estimate_max: isInstant ? est.max : null,
      status: isInstant ? "quoted" : "needs_review",
    })
    .select()
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Could not save your request." }, { status: 500 });
  }

  // 5) notify admin (fire-and-forget is fine, but await keeps it reliable on serverless)
  await notify(lead, "new_lead");

  // 6) response to customer
  return NextResponse.json(
    isInstant
      ? {
          leadId: lead.id,
          mode: "instant",
          estimate: { min: est.min, max: est.max },
          message: "Ойролцоо үнийн санал бэлэн боллоо.",
        }
      : {
          leadId: lead.id,
          mode: "manual",
          message: "Бид таны зургийг хүлээн авлаа. Удахгүй үнийн саналаа илгээх болно.",
        }
  );
}

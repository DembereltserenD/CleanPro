// ============================================================
// app/api/admin/route.ts
// Minimal admin endpoint protected by a shared secret header.
//   GET  ?status=needs_review   -> list leads (+ signed photo URLs)
//   POST { leadId, min, max }   -> set a manual quote, status -> 'quoted'
// Header required: x-admin-secret: <ADMIN_SECRET>
// For a real app, replace this with Supabase Auth + an admin role.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, PHOTO_BUCKET } from "../../../lib/supabase";
import { notify } from "../../../lib/notify";

export const runtime = "nodejs";

function authed(req: NextRequest) {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const db = supabaseAdmin();

  let q = db.from("leads").select("*").order("created_at", { ascending: false }).limit(100);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // attach short-lived signed URLs for photos
  const withUrls = await Promise.all(
    (data ?? []).map(async (l) => {
      let photoUrl: string | null = null;
      if (l.photo_path) {
        const s = await db.storage.from(PHOTO_BUCKET).createSignedUrl(l.photo_path, 60 * 10);
        photoUrl = s.data?.signedUrl ?? null;
      }
      return { ...l, photoUrl };
    })
  );

  return NextResponse.json({ leads: withUrls });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: { leadId?: string; min?: number; max?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const { leadId, min, max } = body;
  if (!leadId || typeof min !== "number" || typeof max !== "number" || min > max) {
    return NextResponse.json({ error: "leadId, min, max (min<=max) required." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: lead, error } = await db
    .from("leads")
    .update({
      estimate_min: min,
      estimate_max: max,
      quote_mode: "manual",
      status: "quoted",
      reviewed_by_admin: true,
    })
    .eq("id", leadId)
    .select()
    .single();

  if (error || !lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  return NextResponse.json({ ok: true, lead });
}

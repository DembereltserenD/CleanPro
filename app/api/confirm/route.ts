// ============================================================
// app/api/confirm/route.ts
// POST { leadId } -> mark confirmed, notify admin again.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { notify } from "../../../lib/notify";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { leadId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const leadId = body.leadId;
  if (!leadId) return NextResponse.json({ error: "leadId required." }, { status: 400 });

  const db = supabaseAdmin();

  // Only confirm leads that are quoted or under review; ignore already-cancelled.
  const { data: lead, error } = await db
    .from("leads")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", leadId)
    .in("status", ["quoted", "needs_review"])
    .select()
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found or not confirmable." }, { status: 404 });
  }

  await notify(lead, "confirmed");

  return NextResponse.json({ ok: true, message: "Баярлалаа! Захиалга баталгаажлаа." });
}

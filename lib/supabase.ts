// ============================================================
// lib/supabase.ts
// Server-side Supabase clients. NEVER import the admin client
// into a client component — it holds the service role key.
// ============================================================
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client — bypasses RLS. Server-only.
export function supabaseAdmin() {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const PHOTO_BUCKET = "sofa-photos";

"use client";
// ============================================================
// app/admin/page.tsx
// Owner dashboard. Enter the ADMIN_SECRET once (stored in this
// browser), then browse all leads with photos, statuses, and set
// manual quotes for ones that need review.
// Talks to /api/admin (GET list, POST manual quote) via the
// x-admin-secret header.
// ============================================================
import { useEffect, useState } from "react";

type Lead = {
  id: string;
  phone: string;
  address: string;
  note: string | null;
  ai_analysis: {
    material?: string;
    seats?: number;
    stain_level?: string;
    confidence?: number;
    description?: string;
  } | null;
  quote_mode: string | null;
  estimate_min: number | null;
  estimate_max: number | null;
  status: string;
  reviewed_by_admin: boolean;
  confirmed_at: string | null;
  created_at: string;
  photoUrl: string | null;
};

const fmt = (n: number) => n.toLocaleString("en-US") + "₮";

const STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "Шинэ", color: "#3b82f6" },
  quoted: { label: "Үнэ өгсөн", color: "#a855f7" },
  needs_review: { label: "Хянах шаардлагатай", color: "#f59e0b" },
  confirmed: { label: "Баталгаажсан", color: "#4ade80" },
  done: { label: "Дууссан", color: "#14b8a6" },
  cancelled: { label: "Цуцалсан", color: "#f87171" },
};

const FILTERS = ["all", "new", "needs_review", "quoted", "confirmed", "done", "cancelled"];

const SECRET_KEY = "cleanpro_admin_secret";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteInputs, setQuoteInputs] = useState<Record<string, { min: string; max: string }>>({});

  useEffect(() => {
    const saved = localStorage.getItem(SECRET_KEY);
    if (saved) {
      setSecret(saved);
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, filter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin${qs}`, { headers: { "x-admin-secret": secret } });
      if (res.status === 401) {
        setError("Нууц үг буруу байна.");
        setAuthed(false);
        localStorage.removeItem(SECRET_KEY);
        return;
      }
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        /* non-JSON */
      }
      if (!res.ok) throw new Error(data.error ?? "Алдаа гарлаа.");
      setLeads(data.leads ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function login() {
    if (!secret) return;
    localStorage.setItem(SECRET_KEY, secret);
    setAuthed(true);
  }

  function logout() {
    localStorage.removeItem(SECRET_KEY);
    setSecret("");
    setAuthed(false);
    setLeads([]);
  }

  async function setQuote(leadId: string) {
    const inp = quoteInputs[leadId];
    const min = Number(inp?.min);
    const max = Number(inp?.max);
    if (!min || !max || min > max) {
      setError("Үнийн доод/дээд дүнг зөв оруулна уу.");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ leadId, min, max }),
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        /* non-JSON */
      }
      if (!res.ok) throw new Error(data.error ?? "Алдаа гарлаа.");
      setQuoteInputs((q) => ({ ...q, [leadId]: { min: "", max: "" } }));
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  // ---------- LOGIN ----------
  if (!authed) {
    return (
      <main style={S.wrap}>
        <div style={S.card}>
          <h1 style={S.h1}>CleanPro — Админ</h1>
          <p style={S.sub}>Нэвтрэхийн тулд админ нууц үгээ оруулна уу.</p>
          <input
            style={S.input}
            type="password"
            placeholder="Админ нууц үг"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          {error && <p style={S.err}>{error}</p>}
          <button style={S.btn} onClick={login}>
            Нэвтрэх
          </button>
        </div>
      </main>
    );
  }

  // ---------- DASHBOARD ----------
  return (
    <main style={S.page}>
      <div style={S.header}>
        <h1 style={S.h1}>CleanPro — Захиалгууд</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.ghost} onClick={load}>
            ↻ Шинэчлэх
          </button>
          <button style={S.ghost} onClick={logout}>
            Гарах
          </button>
        </div>
      </div>

      <div style={S.tabs}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...S.tab, ...(filter === f ? S.tabActive : {}) }}
          >
            {f === "all" ? "Бүгд" : STATUS[f]?.label ?? f}
          </button>
        ))}
      </div>

      {error && <p style={S.err}>{error}</p>}
      {loading && <p style={S.muted}>Ачааллаж байна…</p>}
      {!loading && leads.length === 0 && <p style={S.muted}>Захиалга алга байна.</p>}

      <div style={S.list}>
        {leads.map((l) => {
          const st = STATUS[l.status] ?? { label: l.status, color: "#94a3b8" };
          const a = l.ai_analysis ?? {};
          return (
            <div key={l.id} style={S.lead}>
              {l.photoUrl ? (
                <a href={l.photoUrl} target="_blank" rel="noreferrer">
                  <img src={l.photoUrl} alt="sofa" style={S.photo} />
                </a>
              ) : (
                <div style={{ ...S.photo, ...S.noPhoto }}>Зураг алга</div>
              )}
              <div style={S.info}>
                <div style={S.topRow}>
                  <span style={{ ...S.badge, background: st.color }}>{st.label}</span>
                  <span style={S.muted}>{new Date(l.created_at).toLocaleString("mn-MN")}</span>
                </div>
                <div style={S.field}>
                  <b>Утас:</b>{" "}
                  <a href={`tel:${l.phone}`} style={S.link}>
                    {l.phone}
                  </a>
                </div>
                <div style={S.field}>
                  <b>Хаяг:</b> {l.address}
                </div>
                {l.note && (
                  <div style={S.field}>
                    <b>Тэмдэглэл:</b> {l.note}
                  </div>
                )}
                <div style={S.field}>
                  <b>AI:</b> {a.material ?? "—"}, {a.seats ?? "?"} суудал, {a.stain_level ?? "?"}
                  {a.confidence != null ? ` (итгэл ${Math.round(a.confidence * 100)}%)` : ""}
                </div>
                <div style={S.field}>
                  <b>Үнэ:</b>{" "}
                  {l.estimate_min != null && l.estimate_max != null
                    ? `${fmt(l.estimate_min)} – ${fmt(l.estimate_max)}`
                    : "—"}
                </div>

                <div style={S.quoteRow}>
                  <input
                    style={S.smallInput}
                    inputMode="numeric"
                    placeholder="доод ₮"
                    value={quoteInputs[l.id]?.min ?? ""}
                    onChange={(e) =>
                      setQuoteInputs((q) => ({
                        ...q,
                        [l.id]: { min: e.target.value, max: q[l.id]?.max ?? "" },
                      }))
                    }
                  />
                  <input
                    style={S.smallInput}
                    inputMode="numeric"
                    placeholder="дээд ₮"
                    value={quoteInputs[l.id]?.max ?? ""}
                    onChange={(e) =>
                      setQuoteInputs((q) => ({
                        ...q,
                        [l.id]: { min: q[l.id]?.min ?? "", max: e.target.value },
                      }))
                    }
                  />
                  <button style={S.smallBtn} onClick={() => setQuote(l.id)}>
                    Үнэ оноох
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    background: "#0f1115",
    padding: "24px 16px",
    fontFamily: "system-ui, sans-serif",
  },
  page: {
    minHeight: "100vh",
    background: "#0f1115",
    padding: "24px 16px",
    fontFamily: "system-ui, sans-serif",
    color: "#e9edf3",
    maxWidth: 920,
    margin: "0 auto",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#171a21",
    borderRadius: 20,
    padding: 24,
    color: "#e9edf3",
    boxShadow: "0 10px 40px rgba(0,0,0,.4)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 8,
  },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { fontSize: 14, color: "#9aa4b2", margin: "8px 0 20px" },
  muted: { fontSize: 14, color: "#9aa4b2" },
  tabs: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  tab: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid #2a2f3a",
    background: "transparent",
    color: "#cbd5e1",
    fontSize: 13,
    cursor: "pointer",
  },
  tabActive: { background: "#3b82f6", borderColor: "#3b82f6", color: "white" },
  list: { display: "flex", flexDirection: "column", gap: 14 },
  lead: {
    display: "flex",
    gap: 14,
    background: "#171a21",
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 6px 24px rgba(0,0,0,.3)",
    flexWrap: "wrap",
  },
  photo: {
    width: 120,
    height: 120,
    objectFit: "cover",
    borderRadius: 12,
    flexShrink: 0,
    background: "#0f1115",
  },
  noPhoto: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#5b6472",
    fontSize: 12,
  },
  info: { flex: 1, minWidth: 220 },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  badge: {
    color: "white",
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 999,
  },
  field: { fontSize: 14, color: "#cbd5e1", margin: "3px 0", lineHeight: 1.4 },
  link: { color: "#60a5fa", textDecoration: "none" },
  quoteRow: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  smallInput: {
    width: 90,
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #2a2f3a",
    background: "#0f1115",
    color: "#e9edf3",
    fontSize: 14,
  },
  smallBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "none",
    background: "#3b82f6",
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #2a2f3a",
    background: "#0f1115",
    color: "#e9edf3",
    fontSize: 15,
  },
  btn: {
    width: "100%",
    marginTop: 16,
    padding: "14px",
    borderRadius: 12,
    border: "none",
    background: "#3b82f6",
    color: "white",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  ghost: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid #2a2f3a",
    background: "transparent",
    color: "#cbd5e1",
    fontSize: 14,
    cursor: "pointer",
  },
  err: { color: "#f87171", fontSize: 14, margin: "8px 0" },
};

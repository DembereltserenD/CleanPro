"use client";
// ============================================================
// app/quote-form.tsx
// Shared quote flow component. Rendered at both `/` and `/quote`.
// Steps:
//   1. fill phone + address + note + photo (camera capture on mobile)
//   2. submit -> instant range OR "we'll get back to you"
//   3. confirm booking
// ============================================================
import { useState, useRef } from "react";

type Result =
  | { mode: "instant"; leadId: string; estimate: { min: number; max: number }; message: string; quantity?: number }
  | { mode: "manual"; leadId: string; message: string; quantity?: number };

const fmt = (n: number) => n.toLocaleString("en-US") + "₮";

// Downscale + recompress the photo in the browser before upload.
// Fixes Vercel's 4.5MB request-body limit (raw phone photos exceed it) and
// cuts Claude vision cost — image tokens scale with resolution, and 1568px on
// the long edge is the most a sofa estimate needs.
async function resizeImage(file: File, maxDim = 1568, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = url;
    });
    let { width, height } = img;
    const longEdge = Math.max(width, height);
    if (longEdge > maxDim) {
      const scale = maxDim / longEdge;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        quality
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function QuoteForm() {
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    setError(null);
    if (!phone || !address || !file) {
      setError("Утас, хаяг, зураг гурвыг бөглөнө үү.");
      return;
    }
    setLoading(true);
    try {
      // Shrink the photo client-side; fall back to the original if it fails.
      let photo: Blob = file;
      let filename = file.name || "photo.jpg";
      try {
        photo = await resizeImage(file);
        filename = "photo.jpg";
      } catch {
        /* keep original file */
      }

      const fd = new FormData();
      fd.append("phone", phone);
      fd.append("address", address);
      fd.append("note", note);
      fd.append("quantity", String(Math.max(1, parseInt(quantity, 10) || 1)));
      fd.append("photo", photo, filename);
      const res = await fetch("/api/leads", { method: "POST", body: fd });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        /* non-JSON response (e.g. 413 from the platform) */
      }
      if (!res.ok) {
        throw new Error(
          data.error ?? `Алдаа гарлаа (${res.status}). Зургаа дахин оруулна уу.`
        );
      }
      setResult({ ...data });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!result) return;
    setLoading(true);
    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: result.leadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Алдаа гарлаа.");
      setConfirmed(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------- DONE ----------
  if (confirmed) {
    return (
      <main style={S.wrap}>
        <div style={S.card}>
          <h1 style={S.h1}>Баярлалаа! 🎉</h1>
          <p style={S.p}>Захиалга баталгаажлаа. Бид удахгүй тантай холбогдоно.</p>
        </div>
      </main>
    );
  }

  // ---------- RESULT ----------
  if (result) {
    return (
      <main style={S.wrap}>
        <div style={S.card}>
          {result.mode === "instant" ? (
            <>
              <p style={S.kicker}>Ойролцоо үнийн санал</p>
              <h1 style={S.price}>
                {fmt(result.estimate.min)} – {fmt(result.estimate.max)}
              </h1>
              {result.quantity && result.quantity > 1 && (
                <p style={S.sub}>{result.quantity} ширхэг буйдангийн нийт үнэ</p>
              )}
              <p style={S.p}>
                Эцсийн үнэ газар дээр нь үзсэний дараа батлагдана. Үргэлжлүүлэх үү?
              </p>
            </>
          ) : (
            <>
              <h1 style={S.h1}>Хүлээн авлаа ✅</h1>
              <p style={S.p}>{result.message}</p>
            </>
          )}
          {error && <p style={S.err}>{error}</p>}
          <button style={S.btn} disabled={loading} onClick={confirm}>
            {loading ? "..." : "Захиалга баталгаажуулах"}
          </button>
        </div>
      </main>
    );
  }

  // ---------- FORM ----------
  return (
    <main style={S.wrap}>
      <div style={S.card}>
        <h1 style={S.h1}>Буйдан цэвэрлэгээ — үнийн санал</h1>
        <p style={S.sub}>Зураг илгээгээд хэдхэн секундэд ойролцоо үнээ аваарай.</p>

        <label style={S.label}>Утасны дугаар</label>
        <input style={S.input} inputMode="tel" placeholder="9911xxxx"
          value={phone} onChange={(e) => setPhone(e.target.value)} />

        <label style={S.label}>Гэрийн хаяг</label>
        <input style={S.input} placeholder="Дүүрэг, хороо, байр, тоот"
          value={address} onChange={(e) => setAddress(e.target.value)} />

        <label style={S.label}>Нэмэлт тайлбар (заавал биш)</label>
        <input style={S.input} placeholder="Жнь: муурны үс их, кофены толбо"
          value={note} onChange={(e) => setNote(e.target.value)} />

        <label style={S.label}>Хэдэн ижил буйдан?</label>
        <input style={S.input} inputMode="numeric" placeholder="1"
          value={quantity} onChange={(e) => setQuantity(e.target.value)} />

        <label style={S.label}>Буйдангийн зураг</label>
        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display: "none" }} onChange={onPick} />
        <button type="button" style={S.upload} onClick={() => fileRef.current?.click()}>
          {file ? "Зураг солих" : "📷 Зураг авах / сонгох"}
        </button>
        {preview && <img src={preview} alt="preview" style={S.preview} />}

        {error && <p style={S.err}>{error}</p>}

        <button style={S.btn} disabled={loading} onClick={submit}>
          {loading ? "Шинжилж байна…" : "Үнийн санал авах"}
        </button>
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "flex-start",
    background: "#0f1115", padding: "24px 16px", fontFamily: "system-ui, sans-serif" },
  card: { width: "100%", maxWidth: 440, background: "#171a21", borderRadius: 20, padding: 24,
    color: "#e9edf3", boxShadow: "0 10px 40px rgba(0,0,0,.4)" },
  h1: { fontSize: 22, fontWeight: 700, margin: "0 0 6px" },
  sub: { fontSize: 14, color: "#9aa4b2", margin: "0 0 20px" },
  kicker: { fontSize: 13, color: "#9aa4b2", letterSpacing: 1, textTransform: "uppercase", margin: 0 },
  price: { fontSize: 30, fontWeight: 800, margin: "6px 0 12px", color: "#4ade80" },
  label: { display: "block", fontSize: 13, color: "#9aa4b2", margin: "14px 0 6px" },
  input: { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12,
    border: "1px solid #2a2f3a", background: "#0f1115", color: "#e9edf3", fontSize: 15 },
  upload: { width: "100%", padding: "12px", borderRadius: 12, border: "1px dashed #3a4150",
    background: "transparent", color: "#cbd5e1", fontSize: 15, cursor: "pointer" },
  preview: { width: "100%", borderRadius: 12, marginTop: 12, maxHeight: 240, objectFit: "cover" },
  btn: { width: "100%", marginTop: 20, padding: "14px", borderRadius: 12, border: "none",
    background: "#3b82f6", color: "white", fontSize: 16, fontWeight: 600, cursor: "pointer" },
  p: { fontSize: 15, color: "#cbd5e1", lineHeight: 1.5 },
  err: { color: "#f87171", fontSize: 14, marginTop: 12 },
};

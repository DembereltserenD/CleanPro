// ============================================================
// lib/notify.ts
// One helper, fans out to all channels. Failures are isolated.
// ============================================================

type LeadLike = {
  id: string;
  phone: string;
  address: string;
  note?: string | null;
  status: string;
  quote_mode?: string | null;
  estimate_min?: number | null;
  estimate_max?: number | null;
  ai_analysis?: any;
};

type Event = "new_lead" | "confirmed";

function fmt(n?: number | null) {
  return n == null ? "—" : n.toLocaleString("en-US") + "₮";
}

function message(lead: LeadLike, event: Event): string {
  const head =
    event === "confirmed"
      ? "✅ CONFIRMED booking"
      : lead.status === "needs_review"
      ? "🟡 NEW lead — needs manual quote"
      : "🟢 NEW lead — auto-quoted";

  return [
    head,
    `📞 ${lead.phone}`,
    `📍 ${lead.address}`,
    lead.note ? `📝 ${lead.note}` : null,
    lead.ai_analysis
      ? `🛋️ ${lead.ai_analysis.material}, ${lead.ai_analysis.seats} seats, stain: ${lead.ai_analysis.stain_level} (conf ${lead.ai_analysis.confidence})`
      : null,
    lead.quote_mode === "instant"
      ? `💰 Quoted: ${fmt(lead.estimate_min)} – ${fmt(lead.estimate_max)}`
      : `💰 Quote: pending manual review`,
    `🆔 ${lead.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendEmail(text: string, subject: string) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  const from = process.env.NOTIFY_EMAIL_FROM; // must be a verified Resend sender
  if (!key || !to || !from) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
}

async function sendMessenger(text: string) {
  // Optional: push a message to your own page inbox / a known PSID.
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const recipientId = process.env.FB_ADMIN_PSID; // your own PSID to receive alerts
  if (!token || !recipientId) return;
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: "MESSAGE_TAG",
      tag: "ACCOUNT_UPDATE",
      message: { text },
    }),
  });
}

export async function notify(lead: LeadLike, event: Event) {
  const text = message(lead, event);
  const subject = event === "confirmed" ? "CleanPro: confirmed booking" : "CleanPro: new lead";
  await Promise.allSettled([
    sendTelegram(text),
    sendEmail(text, subject),
    sendMessenger(text),
  ]);
}

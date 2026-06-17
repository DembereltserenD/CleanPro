// ============================================================
// app/api/messenger/route.ts
// Facebook Messenger webhook.
//   GET  -> verification handshake (Meta calls this once)
//   POST -> incoming messages; reply with a button to the quote site.
// Keep the bot dumb: greet, FAQ, and send people to the site.
// ============================================================
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN!;
const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN!;
const SITE_URL = process.env.PUBLIC_SITE_URL!; // e.g. https://cleanpro.mn

// --- GET: webhook verification ---
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

async function send(psid: string, message: any) {
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: psid }, message }),
  });
}

function quoteButton() {
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: "Сайн байна уу! 🛋️ Буйдангийнхаа зургийг илгээгээд хэдхэн секундэд ойролцоо үнээ аваарай.",
        buttons: [{ type: "web_url", url: `${SITE_URL}/quote`, title: "Үнийн санал авах" }],
      },
    },
  };
}

// --- POST: incoming events ---
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.object !== "page") return NextResponse.json({ status: "ignored" });

  for (const entry of body.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      const psid = ev.sender?.id;
      if (!psid) continue;

      const text: string | undefined = ev.message?.text?.toLowerCase();
      // Simple keyword FAQ; everything else -> the quote button.
      if (text?.includes("цаг") || text?.includes("hour") || text?.includes("when")) {
        await send(psid, { text: "Бид 7 хоногийн өдрүүдэд 09:00–20:00 цагт ажиллана." });
      } else {
        await send(psid, quoteButton());
      }
    }
  }
  // Meta needs a fast 200 or it retries.
  return NextResponse.json({ status: "ok" });
}

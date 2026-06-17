# CleanPro — sofa cleaning lead + instant-quote system

Full workflow for a Facebook page → chatbot → site → photo → AI estimate → confirm → notify pipeline.
Stack: **Next.js (App Router) + Supabase + Vercel**, vision via the Anthropic API.

## The flow

```
FB page ──► Messenger bot (button) ──► /quote site form
                                          │  phone + address + photo
                                          ▼
                                    POST /api/leads
                                          │
                 ┌────────────────────────┼─────────────────────────┐
                 ▼                        ▼                          ▼
        upload photo to            AI analyzes photo          insert lead row
        private Storage            (material/seats/stain/      (Supabase)
                                    confidence)
                                          │
                                          ▼
                                  buildEstimate() — HYBRID
                                  ├─ confident + known price ─► instant range shown
                                  └─ low conf / unknown      ─► "needs_review", you quote
                                          │
                                          ▼
                                  notify() ──► Telegram + Email + Messenger
                                          │
                                  customer taps Confirm ──► POST /api/confirm ──► notify() again
```

## Key design choice
**The AI never sets prices.** It only *describes* the sofa. `config/pricing.ts` (your real numbers) turns that description into money. This keeps quotes consistent and under your control. Edit that file to match your business.

## Files
| Path | Purpose |
|------|---------|
| `supabase/schema.sql` | tables, RLS, storage bucket |
| `config/pricing.ts` | **your prices** + confidence threshold |
| `lib/supabase.ts` | server admin client |
| `lib/vision.ts` | photo → structured JSON (Claude) |
| `lib/estimate.ts` | hybrid instant-vs-manual logic |
| `lib/notify.ts` | Telegram + Email + Messenger fan-out |
| `app/api/leads/route.ts` | main submit endpoint |
| `app/api/confirm/route.ts` | customer confirmation |
| `app/api/admin/route.ts` | list leads + set manual quotes |
| `app/api/messenger/route.ts` | FB Messenger webhook |
| `app/quote/page.tsx` | customer-facing form |

## Setup

1. **Supabase**: create a project, open SQL editor, run `supabase/schema.sql`.
2. **Install deps**:
   ```bash
   npm i @supabase/supabase-js @anthropic-ai/sdk
   ```
3. **Env**: copy `.env.local.example` → `.env.local`, fill values. Add the same vars in Vercel → Project → Settings → Environment Variables.
4. **Telegram**: message @BotFather → new bot → get token. Get your chat id (message the bot, then check `https://api.telegram.org/bot<TOKEN>/getUpdates`).
5. **Resend**: create account, verify a sending domain/sender.
6. **Deploy** to Vercel: `vercel` or push to a connected git repo.

## Facebook Messenger bot
1. Create a Meta app + a Facebook Page, add the **Messenger** product.
2. Generate a **Page Access Token** → `FB_PAGE_ACCESS_TOKEN`.
3. Set a **Webhook**: callback URL `https://YOURDOMAIN/api/messenger`, verify token = `FB_VERIFY_TOKEN`, subscribe to `messages` + `messaging_postbacks`.
4. The bot replies to any message with a button linking to `/quote`. That's intentional — the bot stays simple; the site does the work.

## Admin (handling manual quotes)
Until you build a dashboard, use the admin endpoint:
```bash
# list leads needing a manual quote (returns signed photo URLs)
curl -H "x-admin-secret: $ADMIN_SECRET" \
  "https://YOURDOMAIN/api/admin?status=needs_review"

# set a manual quote
curl -X POST -H "x-admin-secret: $ADMIN_SECRET" -H "Content-Type: application/json" \
  -d '{"leadId":"...","min":60000,"max":80000}' \
  "https://YOURDOMAIN/api/admin"
```
You can also just browse the `leads` table in the Supabase dashboard.

## Production hardening (do before real traffic)
- **Rate limiting**: the in-memory limiter in `/api/leads` resets per serverless instance. Swap for Upstash Redis or a Supabase counter.
- **Privacy/consent**: you collect phone + home address + photos. Add a consent checkbox and a short privacy note on `/quote`, and a retention policy (e.g. delete photos after N days).
- **Final price disclaimer**: shown range is an estimate; confirm on-site. Already wired into the UI copy.
- **Admin auth**: replace the shared-secret admin route with Supabase Auth + an admin role for a real dashboard.
- **Photo cleanup**: a scheduled Supabase Edge Function to purge old photos/cancelled leads.
- **Cost control**: vision calls cost money per submission; the rate limiter + phone validation reduce junk.

// ============================================================
// app/quote/page.tsx
// Kept as an alias of the home page so the Messenger bot's
// existing `/quote` link keeps working. Both render QuoteForm.
// ============================================================
import QuoteForm from "../quote-form";

export default function QuotePage() {
  return <QuoteForm />;
}

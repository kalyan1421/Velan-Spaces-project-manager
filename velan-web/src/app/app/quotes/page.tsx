import { redirect } from "next/navigation";

/** Quotes live under their lead; the bare /app/quotes URL goes to the Sales pipeline. */
export default function QuotesIndex() {
  redirect("/app/sales");
}

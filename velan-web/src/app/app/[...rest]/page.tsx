import { notFound } from "next/navigation";

/**
 * Unknown `/app/...` URLs render the app's own not-found inside the shell
 * instead of the public site's 404. Static routes always take precedence.
 */
export default function AppCatchAll() {
  notFound();
}

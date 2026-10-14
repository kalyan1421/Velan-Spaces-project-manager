import { redirect } from "next/navigation";

/** `/app` → `/app/projects` (the interceptor normally does this before render). */
export default function AppIndex() {
  redirect("/app/projects");
}

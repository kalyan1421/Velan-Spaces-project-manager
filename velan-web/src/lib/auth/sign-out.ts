/** Browser-side sign-out: revoke + clear cookies via the route handler, then hard-navigate to /login. */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    // The full navigation below drops all client state either way.
  }
  // A full navigation (not router.push) is deliberate: it drops every in-memory
  // query cache and client state belonging to the old session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login");
}

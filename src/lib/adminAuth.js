import { auth } from "@/auth";

/**
 * Returns the authenticated admin's session.
 *
 * Throws "UNAUTHORIZED" or "FORBIDDEN". Role is already on the session (via
 * the JWT), so this needs no DB call — it's defense-in-depth alongside the
 * middleware's /admin gating in auth.config.js, for /api/admin/* routes and
 * the admin layout.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  if (session.user.role !== "admin") throw new Error("FORBIDDEN");
  return session;
}

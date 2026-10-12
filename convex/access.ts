import { getAuthUserId } from "@convex-dev/auth/server";
export async function owner(ctx: any) {
  const id = await getAuthUserId(ctx);
  if (!id) throw new Error("Sign in to continue.");
  return id;
}
export async function allowed(ctx: any) {
  const id = await owner(ctx);
  const user = await ctx.db.get(id);
  const allow = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (!user?.email || !allow.includes(user.email.toLowerCase()))
    throw new Error("This account has not been enabled by the app owner.");
  return { id, email: user.email, name: user.name ?? user.email.split("@")[0] };
}

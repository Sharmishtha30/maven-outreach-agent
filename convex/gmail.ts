"use node";
import { anyApi } from "convex/server";
import { action } from "./functions";
import { v } from "convex/values";
import { makeRawEmail } from "../shared/rules";
// This module deliberately has no send, delete, or update endpoint.
export const create = action({
  args: { leadId: v.id("leads"), step: v.number(), accessToken: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const user = await ctx.runQuery(anyApi.leads.session, {});
    if (!args.accessToken || args.accessToken.length > 10000)
      throw new Error("Reconnect Gmail.");
    const identity = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${args.accessToken}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!identity.ok) throw new Error("Gmail access expired. Reconnect Gmail.");
    const profile = await identity.json();
    if (
      !profile.email_verified ||
      profile.email?.toLowerCase() !== user.email.toLowerCase()
    )
      throw new Error("Connect the same Google account you signed in with.");
    const reserved = await ctx.runMutation(anyApi.leads.reserve, {
      leadId: args.leadId,
      step: args.step,
      mailbox: profile.email.toLowerCase(),
    });
    if (reserved.existing) {
      if (reserved.operation.status === "created")
        return { id: reserved.operation.gmailId, existing: true };
      throw new Error(
        "This draft already has an unresolved attempt. Check Gmail before retrying; no duplicate was created.",
      );
    }
    const operationId = reserved.operation._id;
    try {
      const raw = makeRawEmail(
        reserved.lead.verification.email,
        profile.email,
        reserved.lead.messages[args.step],
        operationId,
      );
      const result = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${args.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: { raw } }),
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!result.ok) {
        await ctx.runMutation(anyApi.leads.finish, {
          id: operationId,
          status: "failed",
          error: `Gmail returned ${result.status}. No automatic retry.`,
        });
        throw new Error(
          `Gmail rejected this draft (${result.status}). Reconnect if access expired.`,
        );
      }
      const body = await result.json();
      if (!body.id) throw new Error("Gmail did not return a draft ID.");
      await ctx.runMutation(anyApi.leads.finish, {
        id: operationId,
        status: "created",
        gmailId: body.id,
      });
      return { id: body.id, existing: false };
    } catch (error) {
      // A timeout can occur AFTER Gmail saved the draft. Never blindly retry.
      await ctx.runMutation(anyApi.leads.finish, {
        id: operationId,
        status: "check_gmail",
        error:
          "Check Gmail: this attempt may have created a draft. Automatic retry is blocked.",
      });
      throw error;
    }
  },
});

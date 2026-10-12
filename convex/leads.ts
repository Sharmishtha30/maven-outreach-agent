import { anyApi } from "convex/server";
import { query, mutation, internalQuery, internalMutation } from "./functions";
import { v } from "convex/values";
import { allowed, owner } from "./access";
import { canDraft, MAX_BATCH, safeHeader } from "../shared/rules";
import seeds from "../shared/seeds.json";
export const list = query({
  args: {},
  handler: async (ctx) => {
    const id = await owner(ctx);
    return {
      leads: await ctx.db
        .query("leads")
        .withIndex("by_user", (q) => q.eq("userId", id))
        .collect(),
      drafts: await ctx.db
        .query("drafts")
        .withIndex("by_user", (q) => q.eq("userId", id))
        .collect(),
    };
  },
});
export const configuration = query({
  args: {},
  handler: async (ctx) => {
    let enabled = false;
    try {
      await allowed(ctx);
      enabled = true;
    } catch {}
    return {
      enabled,
      research:
        enabled &&
        process.env.ENABLE_PAID_WORKFLOWS === "true" &&
        !!process.env.HUNTER_API_KEY,
      reason: !enabled
        ? "Ask the app owner to enable your account."
        : process.env.ENABLE_PAID_WORKFLOWS !== "true"
          ? "Live research is off until the owner configures providers and reviews charges."
          : !process.env.HUNTER_API_KEY
            ? "Email verification is not configured."
            : "",
    };
  },
});
export const start = mutation({
  args: { seedIds: v.array(v.number()) },
  handler: async (ctx, { seedIds }) => {
    const user = await allowed(ctx);
    if (
      process.env.ENABLE_PAID_WORKFLOWS !== "true" ||
      !process.env.HUNTER_API_KEY
    )
      throw new Error("Live research is not configured.");
    const ids = [...new Set(seedIds)];
    if (
      !ids.length ||
      ids.length > MAX_BATCH ||
      ids.some((id) => !seeds.some((s) => s.id === id))
    )
      throw new Error("Choose 1-10 companies from this list.");
    const recent = await ctx.db
      .query("runs")
      .withIndex("by_user", (q) =>
        q.eq("userId", user.id).gt("createdAt", Date.now() - 86400000),
      )
      .collect();
    if (recent.reduce((sum, r) => sum + r.count, 0) + ids.length > 100)
      throw new Error("The daily research limit is 100 companies per account.");
    const leadIds = [];
    for (const seedId of ids) {
      const old = await ctx.db
        .query("leads")
        .withIndex("by_user_seed", (q) =>
          q.eq("userId", user.id).eq("seedId", seedId),
        )
        .unique();
      if (old && ["queued", "researching"].includes(old.status))
        throw new Error("A selected company is already being researched.");
      if (old) {
        const drafts = await ctx.db
          .query("drafts")
          .withIndex("by_lead_step_mailbox", (q) => q.eq("leadId", old._id))
          .collect();
        if (drafts.length)
          throw new Error(
            "A selected company already has a draft operation. Keep its existing research.",
          );
      }
      const fields = {
        userId: user.id,
        seedId,
        status: "queued",
        updatedAt: Date.now(),
        reviewed: false,
        research: undefined,
        verification: undefined,
        messages: undefined,
        error: undefined,
      };
      if (old) {
        await ctx.db.patch(old._id, fields);
        leadIds.push(old._id);
      } else leadIds.push(await ctx.db.insert("leads", fields));
    }
    await ctx.db.insert("runs", {
      userId: user.id,
      createdAt: Date.now(),
      count: ids.length,
    });
    await ctx.scheduler.runAfter(0, anyApi.research.batch, {
      leadIds,
      senderName: user.name,
    });
    return { count: ids.length };
  },
});
export const edit = mutation({
  args: {
    leadId: v.id("leads"),
    messages: v.array(v.object({ subject: v.string(), body: v.string() })),
    reviewed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const id = await owner(ctx),
      lead = await ctx.db.get(args.leadId);
    if (!lead || lead.userId !== id) throw new Error("Lead not found.");
    if (lead.status !== "ready" || !canDraft(lead.verification))
      throw new Error("This lead is not ready for outreach.");
    if (
      args.messages.length !== 3 ||
      args.messages.some(
        (m) =>
          !m.body.trim() || m.body.length > 12000 || m.subject.length > 150,
      )
    )
      throw new Error("Keep three complete messages with short subjects.");
    args.messages.forEach((m) => safeHeader(m.subject));
    await ctx.db.patch(args.leadId, {
      messages: args.messages,
      reviewed: args.reviewed,
      updatedAt: Date.now(),
    });
  },
});
export const get = internalQuery({
  args: { leadId: v.id("leads") },
  handler: (ctx, { leadId }) => ctx.db.get(leadId),
});
export const update = internalMutation({
  args: { leadId: v.id("leads"), fields: v.any() },
  handler: (ctx, { leadId, fields }) =>
    ctx.db.patch(leadId, { ...fields, updatedAt: Date.now() }),
});
export const session = internalQuery({
  args: {},
  handler: async (ctx) => allowed(ctx),
});
export const reserve = internalMutation({
  args: { leadId: v.id("leads"), step: v.number(), mailbox: v.string() },
  handler: async (ctx, args) => {
    const user = await allowed(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (
      !lead ||
      lead.userId !== user.id ||
      args.mailbox.toLowerCase() !== user.email.toLowerCase()
    )
      throw new Error("Use the same Google account you signed in with.");
    if (
      !Number.isInteger(args.step) ||
      args.step < 0 ||
      args.step > 2 ||
      !lead.reviewed ||
      lead.status !== "ready" ||
      !canDraft(lead.verification)
    )
      throw new Error(
        "Review the messages and verify this contact before creating drafts.",
      );
    const old = await ctx.db
      .query("drafts")
      .withIndex("by_lead_step_mailbox", (q) =>
        q
          .eq("leadId", args.leadId)
          .eq("step", args.step)
          .eq("mailbox", args.mailbox),
      )
      .unique();
    if (old) return { existing: true, operation: old, lead };
    const id = await ctx.db.insert("drafts", {
      userId: user.id,
      ...args,
      status: "creating",
      createdAt: Date.now(),
    });
    return {
      existing: false,
      operation: { _id: id, status: "creating" },
      lead,
    };
  },
});
export const finish = internalMutation({
  args: {
    id: v.id("drafts"),
    status: v.string(),
    gmailId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: (ctx, { id, ...fields }) => ctx.db.patch(id, fields),
});

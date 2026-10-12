import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
export default defineSchema({
  ...authTables,
  leads: defineTable({
    userId: v.id("users"),
    seedId: v.number(),
    status: v.string(),
    updatedAt: v.number(),
    research: v.optional(v.any()),
    verification: v.optional(v.any()),
    messages: v.optional(
      v.array(v.object({ subject: v.string(), body: v.string() })),
    ),
    reviewed: v.boolean(),
    error: v.optional(v.string()),
    threadId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_seed", ["userId", "seedId"]),
  runs: defineTable({
    userId: v.id("users"),
    createdAt: v.number(),
    count: v.number(),
  }).index("by_user", ["userId", "createdAt"]),
  drafts: defineTable({
    userId: v.id("users"),
    leadId: v.id("leads"),
    step: v.number(),
    mailbox: v.string(),
    status: v.string(),
    createdAt: v.number(),
    gmailId: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_lead_step_mailbox", ["leadId", "step", "mailbox"]),
});

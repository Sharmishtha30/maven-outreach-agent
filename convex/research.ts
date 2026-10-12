"use node";
import { anyApi, componentsGeneric } from "convex/server";
import { internalAction } from "./functions";
import { v } from "convex/values";
import { Agent } from "@convex-dev/agent";
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { load } from "cheerio";
import { z } from "zod";
import seeds from "../shared/seeds.json";
import {
  instructions,
  containsEvidence,
  normalize,
  normalizeVerification,
  canDraft,
  safeSource,
  sameCompanyEmail,
} from "../shared/rules";

const outputSchema = z.object({
  supported: z.boolean(),
  reason: z.string().max(500),
  role: z.string().max(200),
  roleQuote: z.string().max(800),
  roleSource: z.string().url(),
  signal: z.string().max(400),
  signalQuote: z.string().max(800),
  signalSource: z.string().url(),
  signalDate: z.string().max(80),
  hypothesis: z.string().max(400),
  messages: z
    .array(
      z.object({
        subject: z.string().min(1).max(150),
        body: z.string().min(1).max(2500),
      }),
    )
    .length(3),
});
async function readPage(url: string, allowed: string[]) {
  let current = safeSource(url, allowed);
  for (let i = 0; i < 4; i++) {
    const r = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "MavenOutreachResearch/0.1 (public company research)",
      },
    });
    if (r.status >= 300 && r.status < 400) {
      current = safeSource(
        new URL(r.headers.get("location") ?? "", current).toString(),
        allowed,
      );
      continue;
    }
    if (!r.ok || !r.headers.get("content-type")?.includes("text/html"))
      throw new Error("Source unavailable or not an HTML page.");
    const reader = r.body?.getReader();
    if (!reader) throw new Error("Empty source.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new Error("Source exceeds the page limit.");
      }
      chunks.push(value);
    }
    const $ = load(Buffer.concat(chunks).toString("utf8"));
    $("script,style,nav,footer,noscript").remove();
    return {
      url,
      text: $("body").text().replace(/\s+/g, " ").trim().slice(0, 50000),
    };
  }
  throw new Error("Too many source redirects.");
}
async function hunter(path: string, params: Record<string, string>) {
  const url = new URL(`https://api.hunter.io/v2/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url, {
    headers: { "X-API-KEY": process.env.HUNTER_API_KEY! },
    signal: AbortSignal.timeout(30000),
  });
  if (r.status === 404) return null;
  if (r.status === 202)
    throw new Error(
      "Email verification is still pending. Retry research later.",
    );
  if (!r.ok)
    throw new Error(
      `Contact provider returned ${r.status}. Check access or quota; no email was marked verified.`,
    );
  return (await r.json()).data;
}
export const batch = internalAction({
  args: { leadIds: v.array(v.id("leads")), senderName: v.string() },
  handler: async (ctx, { leadIds, senderName }): Promise<null> => {
    const [leadId, ...rest] = leadIds;
    if (!leadId) return null;
    try {
      if (
        process.env.ENABLE_PAID_WORKFLOWS !== "true" ||
        !process.env.HUNTER_API_KEY ||
        process.env.HUNTER_API_KEY === "test-api-key"
      )
        throw new Error("Live providers are not configured.");
      const lead = await ctx.runQuery(anyApi.leads.get, { leadId });
      if (!lead || lead.status !== "queued") return null;
      const seed = seeds.find((s) => s.id === lead.seedId)!;
      await ctx.runMutation(anyApi.leads.update, {
        leadId,
        fields: { status: "researching" },
      });
      const urls = [
        ...new Set(
          [seed.source, seed.signal_source, `https://${seed.domain}`].filter(
            Boolean,
          ),
        ),
      ];
      const allowedHosts = [
        ...new Set(
          urls.flatMap((u) => {
            const host = new URL(u).hostname;
            return [
              host,
              host.startsWith("www.") ? host.slice(4) : `www.${host}`,
            ];
          }),
        ),
      ];
      const pages = (
        await Promise.allSettled(urls.map((u) => readPage(u, allowedHosts)))
      ).flatMap((x) => (x.status === "fulfilled" ? [x.value] : []));
      if (!pages.length)
        throw new Error(
          "The public company pages could not be read. Review sources manually.",
        );
      const model = process.env.OPENAI_API_KEY
        ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
            process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
          )
        : convexGateway(process.env.AI_MODEL ?? "openai/gpt-4.1-mini");
      const agent = new Agent((componentsGeneric() as any).agent, {
        name: "Maven account researcher",
        languageModel: model,
        instructions,
      });
      const { threadId } = await agent.createThread(ctx, {
        userId: lead.userId,
      });
      await ctx.runMutation(anyApi.leads.update, {
        leadId,
        fields: { threadId },
      });
      const result = await agent.generateText(
        ctx,
        { threadId },
        {
          prompt: JSON.stringify({
            task: "Refresh this company and named sponsor. Return JSON matching the schema. Quotes must be exact substrings from the supplied pages; URLs must be exact supplied source URLs. If evidence is missing, supported=false. A role statement alone is not a learning signal. Dates can be undated, never guessed.",
            company: seed.company,
            person: seed.name,
            roleHint: seed.role,
            senderName,
            offer:
              "Maven for Business: live practitioner-led courses for teams. Explore one team, one work outcome, and a paid pilot; pricing and scheduling need confirmation.",
            schema: {
              supported: "boolean",
              reason: "string",
              role: "string",
              roleQuote: "exact quote including contact name",
              roleSource: "source URL",
              signal: "fact",
              signalQuote: "exact quote",
              signalSource: "source URL",
              signalDate: "date or undated",
              hypothesis: "proposed need, not confirmed intent",
              messages: [
                { subject: "opening", body: "email" },
                { subject: "useful follow-up", body: "email" },
                { subject: "close", body: "email" },
              ],
            },
            pages,
          }),
          maxOutputTokens: 2400,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(90000),
        },
      );
      const raw = result.text
        .trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "");
      const output = outputSchema.parse(JSON.parse(raw));
      const rolePage = pages.find((p) => p.url === output.roleSource),
        signalPage = pages.find((p) => p.url === output.signalSource);
      if (
        !output.supported ||
        !rolePage ||
        !signalPage ||
        !containsEvidence(rolePage.text, output.roleQuote) ||
        !containsEvidence(signalPage.text, output.signalQuote) ||
        !normalize(output.roleQuote).includes(normalize(seed.name))
      )
        throw new Error(
          output.reason ||
            "Current role and a distinct learning signal could not both be supported.",
        );
      const contact = await hunter("email-finder", {
        domain: seed.domain,
        full_name: seed.name,
      });
      if (!contact?.email || !sameCompanyEmail(contact.email, seed.domain))
        throw new Error(
          "No matching corporate email was found. This lead stays on hold.",
        );
      const checked = await hunter("email-verifier", { email: contact.email });
      const verification = normalizeVerification(checked, contact.email);
      let company: any = null;
      try {
        company = await hunter("companies/find", { domain: seed.domain });
      } catch {
        /* Missing company data does not turn an email into a verified one. */
      }
      const research = {
        role: output.role,
        roleQuote: output.roleQuote,
        roleSource: output.roleSource,
        signal: output.signal,
        signalQuote: output.signalQuote,
        signalSource: output.signalSource,
        signalDate: output.signalDate,
        hypothesis: output.hypothesis,
        checkedAt: Date.now(),
        headcount: company?.metrics?.employees ?? null,
        country: company?.geo?.country ?? null,
        industry: company?.category?.industry ?? null,
        parentDomain: company?.parent?.domain ?? null,
        companyProvider: company ? "Hunter" : null,
        companyIndexedAt: company?.indexedAt ?? null,
      };
      await ctx.runMutation(anyApi.leads.update, {
        leadId,
        fields: {
          research,
          verification,
          messages: output.messages,
          status: canDraft(verification) ? "ready" : "hold",
          reviewed: false,
          error: canDraft(verification)
            ? undefined
            : "Email is not recently verified as valid. Catch-all and unknown results remain on hold.",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Research could not complete.";
      // Do not echo provider payloads or credentials into the app.
      const safe = /api.?key|bearer|sk-[a-z0-9]/i.test(message)
        ? "Provider configuration needs attention."
        : message.slice(0, 300);
      await ctx.runMutation(anyApi.leads.update, {
        leadId,
        fields: { status: "hold", error: safe },
      });
    }
    if (rest.length)
      await ctx.scheduler.runAfter(0, anyApi.research.batch, {
        leadIds: rest,
        senderName,
      });
    return null;
  },
});

# Operator setup

The [repository setup guide](https://github.com/Sharmishtha30/maven-outreach-agent#setup) contains deployment and Google configuration steps. A copied skill does not include the web server or credentials. For assistant-only use, connect public-page research, a corporate-email finder/verifier and Gmail draft creation; if any capability is missing, report the gap and keep the affected contact on hold. `convex/research.ts` is the agent runner; `shared/rules.ts` defines evidence and email gates; `convex/gmail.ts` is the draft-only adapter.

The web app uses Convex Auth for Google sign-in and a separate Google Identity Services consent step for Gmail. Sign-in and connected Gmail email must match. The Gmail access token is short-lived, kept in browser memory and passed to the draft action; it is not saved in the database or agent thread. The Google compose permission can also send email, but the adapter exposes only `drafts.create`.

Live research uses the Convex AI Gateway by default. Local/free deployments may use a server-side OpenAI key. Hunter provides email lookup, separate deliverability verification and company enrichment. Current implementation does not include arbitrary web search, custom uploaded company lists, automatic sending or automatic follow-up scheduling.

Troubleshooting:

- Preview only: configure the public Google client ID and Convex URL, then rebuild.
- Research disabled: check the exact account allowlist, provider key and `ENABLE_PAID_WORKFLOWS`.
- Source blocked/PDF-only: manually review the source and add an approved readable company source; do not bypass the evidence gate.
- Contact on hold: resolve the role or email result. Do not edit server verification fields to bypass the gate.
- Gmail uncertain: check the connected mailbox for the subject and recipient. Do not delete the ledger entry until the operator confirms no draft exists.
- Gmail expired: reconnect using the same signed-in Google account.

Sources: [Gmail drafts](https://developers.google.com/workspace/gmail/api/guides/drafts), [Google token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Convex Auth Google](https://labs.convex.dev/auth/config/oauth/google), [Hunter API](https://hunter.io/api-documentation/v2).

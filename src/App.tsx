import { useEffect, useMemo, useState } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { anyApi } from "convex/server";
import seeds from "../shared/seeds.json";
import { canDraft, type Message } from "../shared/rules";
import { connectGmail, disconnectGmail, prepareGmail } from "./gmail";
type Seed = (typeof seeds)[number];
type Props = {
  live?: boolean;
  signedIn?: boolean;
  records?: any[];
  drafts?: any[];
  config?: any;
  signIn?: () => Promise<any>;
  signOut?: () => Promise<any>;
  research?: (ids: number[]) => Promise<any>;
  save?: (id: string, messages: Message[], reviewed: boolean) => Promise<any>;
  create?: (id: string, step: number, token: string) => Promise<any>;
};
export function LiveApp() {
  const { isAuthenticated } = useConvexAuth(),
    auth = useAuthActions();
  const state = useQuery(anyApi.leads.list, isAuthenticated ? {} : "skip");
  const config = useQuery(anyApi.leads.configuration, {});
  const start = useMutation(anyApi.leads.start),
    save = useMutation(anyApi.leads.edit),
    create = useAction(anyApi.gmail.create);
  return (
    <App
      live
      signedIn={isAuthenticated}
      records={state?.leads}
      drafts={state?.drafts}
      config={config}
      signIn={() => auth.signIn("google")}
      signOut={() => auth.signOut()}
      research={(seedIds) => start({ seedIds })}
      save={(leadId, messages, reviewed) =>
        save({ leadId, messages, reviewed })
      }
      create={(leadId, step, accessToken) =>
        create({ leadId, step, accessToken })
      }
    />
  );
}
function sampleMessages(seed: Seed): Message[] {
  const first = seed.name.split(" ")[0];
  const fact = seed.signal_source
    ? seed.signal
    : "I am exploring how teams at " +
      seed.company +
      " approach practical AI learning.";
  return [
    {
      subject: `A practical learning pilot for ${seed.company}`,
      body: `Hi ${first},\n\n${fact}\n\nI wondered whether one team has a skill gap that its current learning resources do not cover. Maven for Business offers live, practitioner-led courses that could support a focused pilot around a real work task.\n\nIs there a team you are prioritizing this quarter?\n\n[Your name]`,
    },
    {
      subject: `A concrete example for ${seed.company}`,
      body: `Hi ${first},\n\nOne possible starting point: a small product team brings an AI workflow, practises how to evaluate it, and leaves with a checklist its manager can review.\n\nWe would confirm the course, timing and success criteria around the team's needs. Would a short conversation help establish whether this fits?\n\n[Your name]`,
    },
    {
      subject: `Closing the loop`,
      body: `Hi ${first},\n\nI will close the loop here. If applied learning becomes a priority, I would be glad to help match a team's problem to a suitable practitioner-led course.\n\nIf someone else owns this, a pointer would help. Otherwise, no need to reply.\n\n[Your name]`,
    },
  ];
}
function Status({ status }: { status: string }) {
  return (
    <span className={`status ${status}`}>
      {(
        {
          ready: "Ready to review",
          hold: "Needs attention",
          researching: "Researching",
          queued: "In queue",
          pending: "Needs research",
        } as any
      )[status] ?? status}
    </span>
  );
}
export function App(props: Props = {}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All companies"),
    [selected, setSelected] = useState<number[]>([]),
    [active, setActive] = useState(seeds[0].id),
    [tab, setTab] = useState<"evidence" | "draft">("evidence"),
    [step, setStep] = useState(0),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [gmail, setGmail] = useState<{
      token: string;
      email: string;
      expiresAt: number;
    } | null>(null),
    [help, setHelp] = useState(false);
  const seed = seeds.find((s) => s.id === active)!;
  const record = props.records?.find((x) => x.seedId === active);
  const [messages, setMessages] = useState<Message[]>(sampleMessages(seed)),
    [reviewed, setReviewed] = useState(false);
  useEffect(() => {
    setMessages(record?.messages ?? sampleMessages(seed));
    setReviewed(record?.reviewed ?? false);
    setStep(0);
  }, [active, record?.updatedAt]);
  useEffect(() => {
    prepareGmail().catch(() => {});
  }, []);
  useEffect(() => {
    if (!props.signedIn) setGmail(null);
  }, [props.signedIn]);
  const filtered = useMemo(
    () =>
      seeds
        .filter((s) =>
          `${s.company} ${s.name} ${s.segment}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .filter(
          (s) =>
            filter === "All companies" ||
            (filter === "With a signal"
              ? !!s.signal_source
              : filter === "India-linked"
                ? s.market.includes("India")
                : props.records?.some(
                    (r) => r.seedId === s.id && r.status === "ready",
                  )),
        ),
    [search, filter, props.records],
  );
  const ready =
    props.records?.filter(
      (r) => r.status === "ready" && canDraft(r.verification),
    ).length ?? 0;
  const created =
    props.drafts?.filter((d) => d.status === "created").length ?? 0;
  const draftingAllowed =
    !!record && record.status === "ready" && canDraft(record.verification);
  const currentDraft = props.drafts?.find(
    (d) =>
      d.leadId === record?._id &&
      d.step === step &&
      d.mailbox === gmail?.email.toLowerCase(),
  );
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "This action could not finish. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function toggle(id: number) {
    setSelected((xs) =>
      xs.includes(id)
        ? xs.filter((x) => x !== id)
        : xs.length < 10
          ? [...xs, id]
          : xs,
    );
  }
  async function connect() {
    await run(async () => {
      if (!props.live || !props.signedIn) {
        setHelp(true);
        return;
      }
      setGmail(await connectGmail());
      setNotice(
        "Gmail connected. You choose which reviewed messages become drafts.",
      );
    });
  }
  async function draft() {
    await run(async () => {
      if (!gmail || gmail.expiresAt <= Date.now())
        throw new Error("Reconnect Gmail to create a draft.");
      if (!draftingAllowed || !reviewed || !props.save || !props.create)
        throw new Error("Verify the contact and review the message first.");
      await props.save(record._id, messages, true);
      const result = await props.create(record._id, step, gmail.token);
      setNotice(
        result.existing
          ? "This draft already exists in Gmail."
          : "Draft added to Gmail. Nothing was sent.",
      );
    });
  }
  const source = record?.research?.signalSource ?? seed.signal_source;
  return (
    <div className="app">
      <header className="topbar">
        <a href="#" className="brand" aria-label="First conversation home">
          <span className="brandmark">
            f<span>c</span>
          </span>
          <span>
            First conversation<small>For Maven for Business</small>
          </span>
        </a>
        <div className="top-actions">
          <button className="text-button" onClick={() => setHelp(true)}>
            How it works
          </button>
          {props.live && !props.signedIn ? (
            <button
              className="secondary"
              onClick={() =>
                run(async () => {
                  await props.signIn?.();
                })
              }
            >
              Sign in with Google
            </button>
          ) : (
            <button
              className={gmail ? "secondary connected" : "secondary"}
              onClick={connect}
            >
              {gmail ? "Gmail connected" : "Connect Gmail"}
            </button>
          )}
          {props.signedIn && (
            <button
              className="text-button"
              onClick={() =>
                run(async () => {
                  if (gmail) disconnectGmail(gmail.token);
                  setGmail(null);
                  await props.signOut?.();
                })
              }
            >
              Sign out
            </button>
          )}
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="byline">
              An outreach agent, built for thoughtful selling
            </div>
            <h1>A better first conversation.</h1>
            <p>
              Find the reason to reach out. Check the person.
              <br className="desktop" /> Leave a useful email in Gmail, ready
              for a human to send.
            </p>
          </div>
          <div className="intro-note">
            <span className="note-line" />
            <p>
              Research first.
              <br />
              Draft with context.
              <br />
              <strong>You press send.</strong>
            </p>
            <span className="note-line" />
          </div>
        </section>
        <div className="workflow" aria-label="Workflow">
          <div>
            <span>1</span>
            <p>
              Research accounts<small>100 starting companies</small>
            </p>
          </div>
          <div>
            <span>2</span>
            <p>
              Verify &amp; personalize<small>{ready} ready for review</small>
            </p>
          </div>
          <div>
            <span>3</span>
            <p>
              Save to Gmail<small>{created} drafts created</small>
            </p>
          </div>
          <button className="text-button" onClick={() => setHelp(true)}>
            {props.live ? "Workspace setup" : "Preview mode"} ↗
          </button>
        </div>
        {!props.live && (
          <div className="preview-banner">
            <span>
              <strong>Explore the work sample.</strong> These are researched
              accounts, not verified emails. Live research and Gmail require
              setup.
            </span>
            <button
              onClick={() => {
                setTab("draft");
                setNotice(
                  "Sample copy only. No AI request, email lookup or Gmail action was made.",
                );
              }}
            >
              Preview an email
            </button>
          </div>
        )}
        {props.live && props.config?.reason && (
          <div className="preview-banner">
            <span>{props.config.reason}</span>
            <button onClick={() => setHelp(true)}>View setup</button>
          </div>
        )}
        {error && (
          <div className="feedback error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        {notice && (
          <div className="feedback" role="status">
            {notice}
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        <section className="workspace">
          <aside className="accounts">
            <div className="account-heading">
              <h2>
                Target accounts <span>{filtered.length}</span>
              </h2>
              <p>Choose up to 10 for each research run.</p>
              <label className="search">
                <span aria-hidden="true">⌕</span>
                <input
                  aria-label="Search companies"
                  placeholder="Search companies or people"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <select
                aria-label="Filter accounts"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {[
                  "All companies",
                  "With a signal",
                  "India-linked",
                  "Ready to review",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <div className="account-list">
              {filtered.map((s) => {
                const r = props.records?.find((x) => x.seedId === s.id);
                return (
                  <div
                    key={s.id}
                    className={`account-row ${active === s.id ? "active" : ""}`}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${s.company}`}
                      checked={selected.includes(s.id)}
                      disabled={
                        !selected.includes(s.id) && selected.length >= 10
                      }
                      onChange={() => toggle(s.id)}
                    />
                    <button
                      onClick={() => {
                        setActive(s.id);
                        setError("");
                        setNotice("");
                      }}
                    >
                      <span className="company-line">
                        {s.company}
                        <span className={`dot ${r?.status ?? ""}`} />
                      </span>
                      <small>
                        {s.segment} <span> / </span> {s.market}
                      </small>
                    </button>
                  </div>
                );
              })}
              {!filtered.length && (
                <p className="empty">
                  No companies match. Try another search or filter.
                </p>
              )}
            </div>
            <div className="research-bar">
              <span>{selected.length} selected</span>
              <button
                className="primary"
                disabled={
                  busy ||
                  !selected.length ||
                  (props.live && !props.config?.research)
                }
                onClick={() =>
                  run(async () => {
                    if (!props.live) {
                      setHelp(true);
                      return;
                    }
                    await props.research?.(selected);
                    setNotice(
                      `Research queued for ${selected.length} companies. Provider credits may be used.`,
                    );
                    setSelected([]);
                  })
                }
              >
                {busy ? "Working…" : "Run research"}
              </button>
            </div>
          </aside>
          <article className="detail">
            <div className="detail-heading">
              <div>
                <div className="company-domain">{seed.domain}</div>
                <h2>{seed.company}</h2>
              </div>
              <Status status={record?.status ?? "pending"} />
            </div>
            <div className="person">
              <span className="avatar">
                {seed.name
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <strong>{seed.name}</strong>
                <p>{record?.research?.role ?? seed.role}</p>
              </div>
              {seed.profile && (
                <a href={seed.profile} target="_blank" rel="noreferrer">
                  Profile ↗
                </a>
              )}
            </div>
            <div className="tabs" role="tablist">
              <button
                role="tab"
                aria-selected={tab === "evidence"}
                className={tab === "evidence" ? "chosen" : ""}
                onClick={() => setTab("evidence")}
              >
                Evidence &amp; fit
              </button>
              <button
                role="tab"
                aria-selected={tab === "draft"}
                className={tab === "draft" ? "chosen" : ""}
                onClick={() => setTab("draft")}
              >
                Email drafts <span>3</span>
              </button>
            </div>
            {record?.error && <p className="inline-error">{record.error}</p>}
            {tab === "evidence" ? (
              <div className="evidence">
                <div className="evidence-block">
                  <div className="section-label">Why this company</div>
                  <h3>
                    {record?.research?.signal ??
                      (seed.signal_source
                        ? seed.signal
                        : "A learning hypothesis to validate")}
                  </h3>
                  <p className="muted">
                    {record?.research?.signalDate ??
                      seed.signal_date ??
                      "Date not established"}
                  </p>
                  {source ? (
                    <a href={source} target="_blank" rel="noreferrer">
                      Read the source ↗
                    </a>
                  ) : (
                    <p>No distinct buying signal is verified yet.</p>
                  )}
                  {record?.research?.signalQuote && (
                    <blockquote>{record.research.signalQuote}</blockquote>
                  )}
                </div>
                <div className="evidence-block">
                  <div className="section-label">
                    The conversation to explore
                  </div>
                  <p>{record?.research?.hypothesis ?? seed.hypothesis}</p>
                  <small>
                    This is a proposed need. Budget and buying intent are
                    unconfirmed.
                  </small>
                </div>
                <div className="verification">
                  <div>
                    <span
                      className={`verification-icon ${draftingAllowed ? "valid" : ""}`}
                    >
                      {draftingAllowed ? "✓" : "○"}
                    </span>
                    <div>
                      <strong>
                        {draftingAllowed
                          ? "Work email verified"
                          : "Work email not verified"}
                      </strong>
                      <p>
                        {record?.verification?.email ??
                          "The agent will look up and verify the corporate address."}
                      </p>
                    </div>
                  </div>
                  {record?.verification && (
                    <small>
                      {record.verification.provider} ·{" "}
                      {record.verification.status} ·{" "}
                      {record.verification.verifiedAt
                        ? new Date(
                            record.verification.verifiedAt,
                          ).toLocaleDateString()
                        : "No verification date"}
                    </small>
                  )}
                </div>
                <dl className="company-data">
                  <div>
                    <dt>Headcount</dt>
                    <dd>{record?.research?.headcount ?? "Not enriched yet"}</dd>
                  </div>
                  <div>
                    <dt>Headquarters</dt>
                    <dd>{record?.research?.country ?? "Not enriched yet"}</dd>
                  </div>
                </dl>
                <div className="source-note">
                  <a
                    href={record?.research?.roleSource ?? seed.source}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check role source ↗
                  </a>
                  <p>{seed.caution}</p>
                  <small>
                    {record?.research?.checkedAt
                      ? `Refreshed ${new Date(record.research.checkedAt).toLocaleDateString()}`
                      : "Starting research checked 12 October 2026. Refresh before outreach."}
                  </small>
                </div>
              </div>
            ) : (
              <div className="composer">
                <div className="sequence">
                  {["First email", "Follow-up", "Close the loop"].map(
                    (x, i) => (
                      <button
                        key={x}
                        className={step === i ? "chosen" : ""}
                        onClick={() => setStep(i)}
                      >
                        {x}
                      </button>
                    ),
                  )}
                </div>
                {!record?.messages && (
                  <p className="sample-label">
                    Sample copy for preview. Run research to generate
                    evidence-grounded, personalized emails.
                  </p>
                )}
                <div className="to-line">
                  <span>To</span>
                  <strong>
                    {record?.verification?.email ??
                      `${seed.name} · email pending`}
                  </strong>
                </div>
                <label className="subject">
                  <span>Subject</span>
                  <input
                    aria-label="Email subject"
                    value={messages[step].subject}
                    onChange={(e) => {
                      setReviewed(false);
                      setMessages((xs) =>
                        xs.map((x, i) =>
                          i === step ? { ...x, subject: e.target.value } : x,
                        ),
                      );
                    }}
                  />
                </label>
                <textarea
                  className="email-body"
                  aria-label="Email body"
                  value={messages[step].body}
                  onChange={(e) => {
                    setReviewed(false);
                    setMessages((xs) =>
                      xs.map((x, i) =>
                        i === step ? { ...x, body: e.target.value } : x,
                      ),
                    );
                  }}
                />
                <label className="review">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    disabled={!draftingAllowed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  <span>
                    I reviewed the evidence and all three messages, and checked
                    this account is appropriate to contact.
                  </span>
                </label>
                <div className="draft-actions">
                  <div>
                    <strong>
                      {gmail ? gmail.email : "Gmail is not connected"}
                    </strong>
                    <small>
                      Creates a draft. Does not send or schedule email.
                    </small>
                  </div>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !draftingAllowed ||
                      !reviewed ||
                      !gmail ||
                      !!currentDraft
                    }
                    onClick={draft}
                  >
                    {currentDraft?.status === "created"
                      ? "Saved in Gmail"
                      : currentDraft
                        ? "Check Gmail"
                        : busy
                          ? "Creating…"
                          : "Create Gmail draft"}
                  </button>
                </div>
                {currentDraft && (
                  <a
                    className="gmail-link"
                    href="https://mail.google.com/mail/u/0/#drafts"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Gmail drafts (choose {gmail?.email}) ↗
                  </a>
                )}
                {gmail && (
                  <button
                    className="text-button disconnect"
                    onClick={() => {
                      disconnectGmail(gmail.token);
                      setGmail(null);
                    }}
                  >
                    Disconnect Gmail
                  </button>
                )}
              </div>
            )}
          </article>
        </section>
        <footer>
          Built by Sharmishtha Sharma{" "}
          <span>Independent work sample. Not an official Maven product.</span>
          <a
            href="https://github.com/Sharmishtha30/maven-outreach-agent"
            target="_blank"
            rel="noreferrer"
          >
            Agent &amp; skill on GitHub ↗
          </a>
        </footer>
      </main>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close setup"
              onClick={() => setHelp(false)}
            >
              ×
            </button>
            <h2 id="setup-title">From research to your drafts.</h2>
            <ol>
              <li>
                <strong>Choose accounts.</strong> Start with up to 10 companies.
              </li>
              <li>
                <strong>Run the agent.</strong> It reads company sources, checks
                the named role, finds a learning signal, verifies the work email
                and writes three messages.
              </li>
              <li>
                <strong>Review and connect Gmail.</strong> Edit the copy,
                approve the evidence, then add the selected message to your
                drafts.
              </li>
            </ol>
            <div className="setup-note">
              <strong>
                {props.live
                  ? "Workspace configuration"
                  : "This is the public preview"}
              </strong>
              <p>
                {props.live
                  ? "Live use needs an enabled account, Google connection, a contact-provider key and an AI provider. The owner controls access and paid research."
                  : "You can explore all 100 companies and edit sample emails. No live AI, contact lookup or Gmail action runs in preview mode."}
              </p>
              <p>
                Google’s Gmail permission also permits sending; this app
                implements draft creation only. Gmail access stays in memory and
                is not saved as a refresh token.
              </p>
            </div>
            <a
              className="primary link-button"
              href="https://github.com/Sharmishtha30/maven-outreach-agent#setup"
              target="_blank"
              rel="noreferrer"
            >
              Open setup guide
            </a>
          </section>
        </div>
      )}
    </div>
  );
}

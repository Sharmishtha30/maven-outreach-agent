import test from "node:test";
import assert from "node:assert/strict";
import {
  canDraft,
  containsEvidence,
  makeRawEmail,
  normalizeVerification,
  safeSource,
  sameCompanyEmail,
  VERIFICATION_MAX_AGE,
} from "../shared/rules";
const now = Date.UTC(2026, 9, 12);
test("only dated, recently verified corporate addresses clear the draft gate", () => {
  const response = {
    email: "buyer@company.com",
    status: "valid",
    accept_all: false,
    webmail: false,
    disposable: false,
    verification: { date: "2026-10-01" },
  };
  const verified = normalizeVerification(response, response.email, now);
  assert.equal(canDraft(verified, now), true);
  for (const status of ["unknown", "accept_all", "invalid", "webmail"])
    assert.equal(canDraft({ ...verified, status }, now), false);
  for (const field of ["accept_all", "webmail", "disposable"])
    assert.equal(
      canDraft(
        normalizeVerification(
          { ...response, [field]: true },
          response.email,
          now,
        ),
        now,
      ),
      false,
    );
  assert.equal(
    canDraft(
      normalizeVerification(
        { ...response, verification: { date: null } },
        response.email,
        now,
      ),
      now,
    ),
    false,
  );
  assert.equal(
    canDraft({ ...verified, verifiedAt: now - VERIFICATION_MAX_AGE - 1 }, now),
    false,
  );
  assert.equal(canDraft({ ...verified, verifiedAt: now + 100 }, now), false);
  assert.equal(
    canDraft(normalizeVerification(response, "other@company.com", now), now),
    false,
  );
  assert.equal(sameCompanyEmail("buyer@gmail.com", "company.com"), false);
});
test("draft MIME preserves Unicode and rejects injected recipients and subjects", () => {
  const raw = makeRawEmail(
    "buyer@company.com",
    "sender@example.com",
    {
      subject: "Learning for André",
      body: "Hello André,\nA useful conversation.",
    },
    "op_123",
  );
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(mime, /Message-ID: <op_123@outreach-drafts.invalid>/);
  assert.match(mime, /To: buyer@company.com/);
  assert.equal(
    Buffer.from(
      mime.split("\r\n\r\n")[1].replace(/\r\n/g, ""),
      "base64",
    ).toString(),
    "Hello André,\nA useful conversation.",
  );
  assert.throws(() =>
    makeRawEmail(
      "buyer@company.com\r\nBcc: leak@evil.com",
      "sender@example.com",
      { subject: "Hello", body: "Body" },
      "op1",
    ),
  );
  assert.throws(() =>
    makeRawEmail(
      "buyer@company.com",
      "sender@example.com",
      { subject: "Hello\nBcc: leak@evil.com", body: "Body" },
      "op1",
    ),
  );
});
test("evidence must actually appear in source text", () => {
  const text =
    "Our Chief People Officer, Ee Lyn Khoo, leads our weekly AI Fridays.";
  assert.equal(
    containsEvidence(text, "Ee Lyn Khoo, leads our weekly AI Fridays."),
    true,
  );
  assert.equal(
    containsEvidence(text, "Our company has a $1 million training budget."),
    false,
  );
  assert.equal(containsEvidence(text, "AI"), false);
});
test("source fetch rejects arbitrary destinations and credentials", () => {
  const allowed = ["company.com"];
  assert.equal(
    safeSource("https://company.com/people", allowed).hostname,
    "company.com",
  );
  for (const url of [
    "http://company.com",
    "https://127.0.0.1",
    "https://company.com.evil.com",
    "https://user:secret@company.com",
    "https://company.com:444",
  ])
    assert.throws(() => safeSource(url, allowed));
});

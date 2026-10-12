import test from "node:test";
import assert from "node:assert/strict";
import buyers from "../shared/buyers.json";
import seeds from "../shared/seeds.json";
test("buyer evidence cannot masquerade as verified emails or budget authority", () => {
  assert.equal(new Set(buyers.map((b) => b.seedId)).size, buyers.length);
  for (const b of buyers) {
    assert.ok(seeds.some((s) => s.id === b.seedId));
    assert.ok(b.sources.length && b.checkedAt && b.roleEvidence);
    b.sources.forEach((s) => assert.equal(new URL(s.url).protocol, "https:"));
    assert.equal(b.emailStatus, "not_verified");
    assert.equal(b.workEmail, null);
    assert.equal(b.emailProvider, null);
    assert.equal(b.emailVerifiedAt, null);
    assert.match(b.budgetAuthority, /Not confirmed/);
  }
});

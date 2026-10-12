import test from "node:test";
import assert from "node:assert/strict";
import learning from "../shared/ld-research.json";
import seeds from "../shared/seeds.json";
test("every account has exactly one sourced learning record", () => {
  assert.equal(learning.length, 100);
  assert.deepEqual(
    learning.map((x) => x.seedId).sort((a, b) => a - b),
    seeds.map((x) => x.id).sort((a, b) => a - b),
  );
  for (const row of learning) {
    assert.equal(new URL(row.teamSource).protocol, "https:");
    assert.ok(row.teamSourcePeriod && row.teamEvidence && row.checkedAt);
    assert.equal(
      row.currentCompanyBudget,
      "Not publicly established in this review",
    );
    if (row.publishedAmount) {
      assert.notEqual(row.budgetKind, "undisclosed");
      assert.ok(row.budgetPeriod && row.budgetScope && row.budgetSource);
      assert.equal(new URL(row.budgetSource!).protocol, "https:");
    } else assert.equal(row.budgetKind, "undisclosed");
  }
});

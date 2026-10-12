import learning from "../shared/ld-research.json";
type Row = (typeof learning)[number];
const labels: Record<string, string> = {
  confirmed: "Team or function evidenced",
  programme: "Learning programme evidenced; department not established",
  unconfirmed: "L&D department not established",
  allowance: "Employee allowance",
  per_employee_spend: "Reported spending per employee",
  company_spend: "Historical company spending",
  partial_spend: "Historical spending on one programme",
  undisclosed: "Amount not found",
};
export function LearningIntel({ row }: { row: Row }) {
  return (
    <section
      className="evidence learning-intel"
      aria-label="Learning and development research"
    >
      <p className="research-summary">
        100 companies researched · 28 team/function · 69 programme only · 3 not
        established · 12 published amounts
      </p>
      <div className="evidence-block">
        <div className="section-label">Does it have L&D?</div>
        <h3>{labels[row.teamStatus]}</h3>
        <p>{row.teamEvidence}</p>
        <p className="muted">Source period: {row.teamSourcePeriod}</p>
        <a href={row.teamSource} target="_blank" rel="noreferrer">
          Read the organisation evidence ↗
        </a>
      </div>
      <div className="evidence-block">
        <div className="section-label">Published learning money</div>
        <h3>
          {row.publishedAmount ?? "Not publicly quantified in this review"}
        </h3>
        <p>
          <strong>{labels[row.budgetKind]}</strong>
        </p>
        <p>{row.budgetScope}</p>
        {row.budgetPeriod && (
          <p className="muted">Period: {row.budgetPeriod}</p>
        )}
        {row.budgetSource && (
          <a href={row.budgetSource} target="_blank" rel="noreferrer">
            Read the amount and scope ↗
          </a>
        )}
      </div>
      <div className="evidence-block">
        <div className="section-label">
          Current company budget available to buy
        </div>
        <h3>{row.currentCompanyBudget}</h3>
        <p>
          Ask the learning owner what budget is available for external courses,
          who approves it, and when it resets. Past spending and individual
          allowances do not establish a team purchasing budget.
        </p>
      </div>
      <p className="muted">
        Checked 12 October 2026 through public web searches and selected
        source-page reads. Some sources are historical or undated. A learning
        programme does not prove a dedicated department; missing evidence does
        not mean no department or zero budget. Figures retain their original
        currency and scope.
      </p>
    </section>
  );
}

import buyers from "../shared/buyers.json";
export function BuyerIntel({ seedId }: { seedId: number }) {
  const buyer = buyers.find((b) => b.seedId === seedId);
  if (!buyer)
    return (
      <section className="evidence">
        <h3>Buyer research not yet completed for this account</h3>
        <p>
          Use the “Buyer shortlist” filter to see the 10 accounts researched
          first. Selection favours learning evidence, a relevant programme and a
          plausible route to a purchasing conversation.
        </p>
      </section>
    );
  return (
    <section
      className="evidence learning-intel"
      aria-label="Buyer and contact research"
    >
      <p className="research-summary">
        10 accounts reviewed · 7 sourced learning leaders · 1 provisional · 2 on
        hold · 0 verified direct emails
      </p>
      <div className="evidence-block">
        <div className="section-label">
          {buyer.roleStatus === "supported"
            ? "Learning leader — role supported by source"
            : buyer.roleStatus === "provisional"
              ? "Provisional — confirm current title"
              : "On hold — conflicting employment evidence"}
        </div>
        <h3>{buyer.name}</h3>
        <p>
          <strong>{buyer.role}</strong>
        </p>
        <p>{buyer.roleEvidence}</p>
        {buyer.sources.map((s) => (
          <p key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label} ↗
            </a>
            <br />
            <small>{s.period}</small>
          </p>
        ))}
      </div>
      <div className="evidence-block">
        <div className="section-label">Why prioritize this account?</div>
        <p>{buyer.priorityReason}</p>
        <h3>Budget authority still needs confirmation</h3>
        <p>{buyer.budgetAuthority}</p>
      </div>
      <div className="evidence-block">
        <div className="section-label">Direct work email</div>
        <h3>Not verified — outreach on hold</h3>
        <p>{buyer.emailNote}</p>
        {buyer.publicTeamMailbox && (
          <p>
            <strong>
              Published team inbox: {buyer.publicTeamMailbox.email}
            </strong>
            <br />
            {buyer.publicTeamMailbox.note}
            <br />
            <a
              href={buyer.publicTeamMailbox.source}
              target="_blank"
              rel="noreferrer"
            >
              Official mailbox source ↗
            </a>
          </p>
        )}
      </div>
      <div className="evidence-block">
        <div className="section-label">Next qualification step</div>
        <p>{buyer.nextStep}</p>
      </div>
      <p className="muted">
        Checked 12 October 2026. This is a buyer-research shortlist, not a
        confirmed list of budget holders. These additional contacts are not
        substituted into the original sponsor’s email drafts. Direct emails need
        provider verification before outreach.
      </p>
    </section>
  );
}

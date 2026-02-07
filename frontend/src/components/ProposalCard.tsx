import type { TaskProposal, Priority } from "../types";

interface Props {
  proposal: TaskProposal;
  index: number;
  onChange: (index: number, updated: TaskProposal) => void;
  onRemove: (index: number) => void;
}

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

/**
 * Editable card for a single parsed task proposal.
 *
 * Kept intentionally small — the parent manages saving and validation.
 */
export default function ProposalCard({ proposal, index, onChange, onRemove }: Props) {
  const update = (field: keyof TaskProposal, value: unknown) => {
    onChange(index, { ...proposal, [field]: value } as TaskProposal);
  };

  return (
    <div className="proposal-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4>Task {index + 1}</h4>
        <button className="btn-icon" onClick={() => onRemove(index)} title="Remove">
          &#x2715;
        </button>
      </div>

      <div className="proposal-field">
        <label>Name</label>
        <input type="text" value={proposal.name} onChange={(e) => update("name", e.target.value)} />
      </div>

      <div className="proposal-field">
        <label>Description</label>
        <input
          type="text"
          value={proposal.description ?? ""}
          onChange={(e) => update("description", e.target.value || null)}
        />
      </div>

      <div className="proposal-field">
        <label>Tags</label>
        <input
          type="text"
          value={proposal.tags.join(", ")}
          onChange={(e) =>
            update(
              "tags",
              e.target.value
                .split(",")
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean)
            )
          }
        />
      </div>

      <div className="proposal-field">
        <label>Priority</label>
        <select value={proposal.priority} onChange={(e) => update("priority", e.target.value as Priority)}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="proposal-field">
        <label>Due</label>
        <input
          type="text"
          value={proposal.due_at ?? ""}
          onChange={(e) => update("due_at", e.target.value || null)}
          placeholder="ISO date or leave empty"
        />
      </div>

      {proposal.assumptions.length > 0 && (
        <div className="proposal-assumptions">
          <strong>Assumptions:</strong>
          <ul style={{ marginLeft: 16, marginTop: 4 }}>
            {proposal.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {proposal.confidence != null && proposal.confidence <= 0.5 && <div className="proposal-confidence">Review recommended</div>}
    </div>
  );
}

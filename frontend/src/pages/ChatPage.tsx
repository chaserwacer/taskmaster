import { useState } from "react";
import type { TaskProposal } from "../types";
import { chatParse, chatCommit } from "../api";
import ProposalCard from "../components/ProposalCard";

interface ChatEntry {
  id: number;
  rawText: string;
  proposals: TaskProposal[];
  warnings: string[];
  committed: boolean;
  loading: boolean;
}

interface Props {
  onTasksCreated: () => void;
}

let nextId = 1;

export default function ChatPage({ onTasksCreated }: Props) {
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [parsing, setParsing] = useState(false);

  const handleParse = async () => {
    const text = input.trim();
    if (!text) return;

    const entryId = nextId++;
    const entry: ChatEntry = {
      id: entryId,
      rawText: text,
      proposals: [],
      warnings: [],
      committed: false,
      loading: true,
    };

    setEntries((prev) => [entry, ...prev]);
    setInput("");
    setParsing(true);

    try {
      const result = await chatParse(text);
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, proposals: result.proposals, warnings: result.warnings, loading: false }
            : e
        )
      );
    } catch (err) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                warnings: [`Failed to parse: ${err instanceof Error ? err.message : err}`],
                loading: false,
              }
            : e
        )
      );
    } finally {
      setParsing(false);
    }
  };

  const handleProposalChange = (entryId: number, index: number, updated: TaskProposal) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        const proposals = [...e.proposals];
        proposals[index] = updated;
        return { ...e, proposals };
      })
    );
  };

  const handleProposalRemove = (entryId: number, index: number) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        const proposals = e.proposals.filter((_, i) => i !== index);
        return { ...e, proposals };
      })
    );
  };

  const handleCommit = async (entryId: number) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || entry.proposals.length === 0) return;

    try {
      await chatCommit(entry.proposals, entry.rawText);
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, committed: true } : e))
      );
      onTasksCreated();
    } catch (err) {
      alert(`Failed to commit: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleParse();
    }
  };

  return (
    <div className="chat-page">
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
        Chat — Paste raw text to create tasks
      </h2>

      <div className="chat-input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            'Paste messy text here...\ne.g. "remind me next Tuesday to call the dentist, also buy eggs and milk tomorrow"'
          }
          disabled={parsing}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            className="btn-primary"
            onClick={handleParse}
            disabled={parsing || !input.trim()}
            style={{ height: "100%" }}
          >
            {parsing ? (
              <>
                <span className="spinner" /> Parsing...
              </>
            ) : (
              "Parse"
            )}
          </button>
          <span style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
            Ctrl+Enter
          </span>
        </div>
      </div>

      <div className="chat-history">
        {entries.map((entry) => (
          <div key={entry.id} className="chat-entry">
            <div className="chat-entry-header">
              <span>Raw input</span>
              {entry.committed && <span className="badge badge-chat">committed</span>}
            </div>
            <div className="chat-raw-text">{entry.rawText}</div>

            {entry.loading && (
              <div className="loading-center" style={{ padding: 24 }}>
                <span className="spinner" />
              </div>
            )}

            {entry.warnings.length > 0 && (
              <div className="chat-warnings">
                {entry.warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}

            {!entry.loading && entry.proposals.length > 0 && (
              <>
                <div className="chat-proposals">
                  {entry.proposals.map((p, i) => (
                    <ProposalCard
                      key={i}
                      proposal={p}
                      index={i}
                      onChange={(idx, updated) => handleProposalChange(entry.id, idx, updated)}
                      onRemove={(idx) => handleProposalRemove(entry.id, idx)}
                    />
                  ))}
                </div>

                {entry.committed ? (
                  <div className="chat-committed">
                    Tasks saved successfully.
                  </div>
                ) : (
                  <div className="chat-commit-bar">
                    <button
                      className="btn-primary"
                      onClick={() => handleCommit(entry.id)}
                    >
                      Commit {entry.proposals.length} task
                      {entry.proposals.length !== 1 ? "s" : ""}
                    </button>
                  </div>
                )}
              </>
            )}

            {!entry.loading && entry.proposals.length === 0 && entry.warnings.length === 0 && (
              <div className="empty-state" style={{ padding: 24 }}>
                <p>No tasks extracted from this input.</p>
              </div>
            )}
          </div>
        ))}

        {entries.length === 0 && (
          <div className="empty-state">
            <p>No chat history yet.</p>
            <p>
              Type or paste raw text above and click Parse. The AI will convert it into structured
              tasks you can review and commit.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import type { Task, TaskFilters, TaskProposal } from "./types";
import { fetchTasks, chatParse, chatCommit } from "./api";
import TaskItem from "./components/TaskItem";
import TaskModal from "./components/TaskModal";
import ProposalCard from "./components/ProposalCard";

interface ChatEntry {
  id: number;
  rawText: string;
  proposals: TaskProposal[];
  warnings: string[];
  committed: boolean;
  loading: boolean;
}

const FILTER_STORAGE_KEY = "taskcopilot_filters";
let nextChatId = 1;

function loadFilters(): TaskFilters {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveFilters(f: TaskFilters) {
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(f));
}

export default function App() {
  // Task state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(loadFilters);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [parsing, setParsing] = useState(false);

  // Filter
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadTasks = useCallback(
    async (f?: TaskFilters) => {
      setLoading(true);
      try {
        const { q: _, ...apiFilters } = f ?? filters;
      const data = await fetchTasks(apiFilters);
        setTasks(data);
      } catch (err) {
        console.error("Failed to load tasks:", err);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleFiltersChange = (f: TaskFilters) => {
    setFilters(f);
    saveFilters(f);
    loadTasks(f);
  };

  const refresh = () => loadTasks();

  // Client-side search: matches name, description, notes, tags, and priority
  const filteredTasks = filters.q
    ? tasks.filter((t) => {
        const q = filters.q!.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false) ||
          (t.notes?.toLowerCase().includes(q) ?? false) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          t.priority.includes(q)
        );
      })
    : tasks;

  // ---- Chat handlers ----

  const handleParse = async () => {
    const text = chatInput.trim();
    if (!text) return;

    const entryId = nextChatId++;
    const entry: ChatEntry = {
      id: entryId,
      rawText: text,
      proposals: [],
      warnings: [],
      committed: false,
      loading: true,
    };

    setChatEntries((prev) => [entry, ...prev]);
    setChatInput("");
    setParsing(true);

    try {
      const result = await chatParse(text);
      setChatEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, proposals: result.proposals, warnings: result.warnings, loading: false }
            : e
        )
      );
    } catch (err) {
      setChatEntries((prev) =>
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
    setChatEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        const proposals = [...e.proposals];
        proposals[index] = updated;
        return { ...e, proposals };
      })
    );
  };

  const handleProposalRemove = (entryId: number, index: number) => {
    setChatEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        return { ...e, proposals: e.proposals.filter((_, i) => i !== index) };
      })
    );
  };

  const handleCommit = async (entryId: number) => {
    const entry = chatEntries.find((e) => e.id === entryId);
    if (!entry || entry.proposals.length === 0) return;

    try {
      await chatCommit(entry.proposals, entry.rawText);
      setChatEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, committed: true } : e))
      );
      refresh();
    } catch (err) {
      alert(`Failed to commit: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleParse();
    }
  };

  // ---- Filter handlers ----

  const handleSearch = (val: string) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const updated = { ...filters, q: val || undefined };
      setFilters(updated);
      saveFilters(updated);
    }, 300);
  };

  const setStatus = (val: boolean | null) => {
    handleFiltersChange({ ...filters, is_complete: val });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Task Master</h1>
        <button className="btn-new-task" onClick={() => setShowCreate(true)}>
          + New Task
        </button>
      </header>

      <main className="app-main">
        {/* ---- Chat Section ---- */}
        <section className="section-chat">
          <div className="chat-card">
            <textarea
              className="chat-textarea"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder='Describe your tasks naturally... e.g. "remind me to call the dentist next Tuesday and buy groceries tomorrow"'
              disabled={parsing}
              rows={3}
            />
            <div className="chat-card-footer">
              <span className="chat-hint">Ctrl+Enter to parse</span>
              <button
                className="btn-parse"
                onClick={handleParse}
                disabled={parsing || !chatInput.trim()}
              >
                {parsing ? "Parsing..." : "Parse"}
              </button>
            </div>
          </div>

          {chatEntries.map((entry) => (
            <div key={entry.id} className="chat-entry-card">
              <div className="chat-entry-input-text">{entry.rawText}</div>

              {entry.loading && (
                <div className="chat-loading">
                  <span className="spinner" />
                </div>
              )}

              {entry.warnings.length > 0 && (
                <div className="chat-warnings">
                  {entry.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              )}

              {!entry.loading && entry.proposals.length > 0 && (
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
                  {entry.committed ? (
                    <div className="chat-committed-badge">Tasks saved</div>
                  ) : (
                    <button className="btn-commit" onClick={() => handleCommit(entry.id)}>
                      Commit {entry.proposals.length} task
                      {entry.proposals.length !== 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              )}

              {!entry.loading && entry.proposals.length === 0 && entry.warnings.length === 0 && (
                <div className="chat-no-results">No tasks extracted.</div>
              )}
            </div>
          ))}
        </section>

        {/* ---- Tasks Section ---- */}
        <section className="section-tasks">
          <div className="tasks-header">
            <h2>
              Your Tasks
              <span className="tasks-count">{filteredTasks.length}</span>
            </h2>
          </div>

          <div className="filter-bar">
            <input
              type="search"
              className="filter-search"
              placeholder="Search..."
              defaultValue={filters.q ?? ""}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <div className="segmented-control">
              <button
                className={filters.is_complete == null ? "active" : ""}
                onClick={() => setStatus(null)}
              >
                All
              </button>
              <button
                className={filters.is_complete === false ? "active" : ""}
                onClick={() => setStatus(false)}
              >
                Active
              </button>
              <button
                className={filters.is_complete === true ? "active" : ""}
                onClick={() => setStatus(true)}
              >
                Done
              </button>
            </div>
          </div>

          {loading ? (
            <div className="tasks-loading">
              <span className="spinner" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="tasks-empty">
              <p>No tasks found</p>
              <p>Create one or adjust your filters.</p>
            </div>
          ) : (
            <div className="task-list">
              {filteredTasks.map((t) => (
                <TaskItem key={t.id} task={t} onRefresh={refresh} onEdit={setEditTask} />
              ))}
            </div>
          )}
        </section>
      </main>

      {showCreate && (
        <TaskModal task={null} onClose={() => setShowCreate(false)} onSaved={refresh} />
      )}
      {editTask && (
        <TaskModal task={editTask} onClose={() => setEditTask(null)} onSaved={refresh} />
      )}
    </div>
  );
}

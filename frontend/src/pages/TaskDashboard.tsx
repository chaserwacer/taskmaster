import { useState, useRef } from "react";
import type { Task, TaskFilters, Priority } from "../types";
import TaskItem from "../components/TaskItem";
import TaskModal from "../components/TaskModal";

interface Props {
  tasks: Task[];
  loading: boolean;
  filters: TaskFilters;
  allTags: string[];
  onFiltersChange: (f: TaskFilters) => void;
  onRefresh: () => void;
}

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const DUE_OPTIONS = [
  { value: null, label: "All" },
  { value: "overdue" as const, label: "Overdue" },
  { value: "today" as const, label: "Today" },
  { value: "upcoming" as const, label: "Upcoming" },
  { value: "none" as const, label: "No date" },
];

export default function TaskDashboard({
  tasks,
  loading,
  filters,
  allTags,
  onFiltersChange,
  onRefresh,
}: Props) {
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = (val: string) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      onFiltersChange({ ...filters, q: val || undefined });
    }, 300);
  };

  const toggleTag = (tag: string) => {
    onFiltersChange({
      ...filters,
      tag: filters.tag === tag ? undefined : tag,
    });
  };

  const setStatus = (val: boolean | null) => {
    onFiltersChange({
      ...filters,
      is_complete: val,
    });
  };

  const setPriority = (val: Priority | null) => {
    onFiltersChange({
      ...filters,
      priority: val,
    });
  };

  const setDue = (val: TaskFilters["due"]) => {
    onFiltersChange({
      ...filters,
      due: val,
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasFilters =
    filters.q || filters.tag || filters.is_complete != null || filters.priority || filters.due;

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="card">
          <h3>Search</h3>
          <input
            type="search"
            placeholder="Search tasks..."
            defaultValue={filters.q ?? ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="card">
          <h3>Status</h3>
          <div className="filter-chips">
            <button
              className={`chip ${filters.is_complete == null ? "active" : ""}`}
              onClick={() => setStatus(null)}
            >
              All
            </button>
            <button
              className={`chip ${filters.is_complete === false ? "active" : ""}`}
              onClick={() => setStatus(false)}
            >
              Active
            </button>
            <button
              className={`chip ${filters.is_complete === true ? "active" : ""}`}
              onClick={() => setStatus(true)}
            >
              Done
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Priority</h3>
          <div className="filter-chips">
            <button
              className={`chip ${!filters.priority ? "active" : ""}`}
              onClick={() => setPriority(null)}
            >
              All
            </button>
            {PRIORITIES.map((p) => (
              <button
                key={p}
                className={`chip ${filters.priority === p ? "active" : ""}`}
                onClick={() => setPriority(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Due</h3>
          <div className="filter-chips">
            {DUE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                className={`chip ${filters.due === opt.value ? "active" : ""}`}
                onClick={() => setDue(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="card">
            <h3>Tags</h3>
            <div className="filter-chips">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={`chip ${filters.tag === tag ? "active" : ""}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasFilters && (
          <button className="btn-secondary btn-sm" onClick={clearFilters}>
            Clear all filters
          </button>
        )}
      </div>

      {/* Main */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>
            Tasks{" "}
            <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 13 }}>
              ({tasks.length})
            </span>
          </h2>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + New Task
          </button>
        </div>

        {loading ? (
          <div className="loading-center">
            <span className="spinner" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks found</p>
            <p>Create one or adjust your filters.</p>
          </div>
        ) : (
          <div className="task-list">
            {tasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                onRefresh={onRefresh}
                onEdit={setEditTask}
                onTagClick={(tag) => toggleTag(tag)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <TaskModal
          task={null}
          onClose={() => setShowCreate(false)}
          onSaved={onRefresh}
        />
      )}
      {editTask && (
        <TaskModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}

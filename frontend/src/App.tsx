import { useState, useEffect, useCallback } from "react";
import type { Task, TaskFilters } from "./types";
import { fetchTasks } from "./api";
import TaskDashboard from "./pages/TaskDashboard";
import ChatPage from "./pages/ChatPage";
import TagGroupPage from "./pages/TagGroupPage";

type Page = "tasks" | "chat" | "tags";

const FILTER_STORAGE_KEY = "taskcopilot_filters";

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
  const [page, setPage] = useState<Page>("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(loadFilters);

  const loadTasks = useCallback(
    async (f?: TaskFilters) => {
      setLoading(true);
      try {
        const data = await fetchTasks(f ?? filters);
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

  // Collect all unique tags from loaded tasks for filter sidebar
  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags))).sort();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Task Copilot</h1>
        <nav className="nav-links">
          <button
            className={page === "tasks" ? "active" : ""}
            onClick={() => setPage("tasks")}
          >
            Tasks
          </button>
          <button
            className={page === "chat" ? "active" : ""}
            onClick={() => setPage("chat")}
          >
            Chat
          </button>
          <button
            className={page === "tags" ? "active" : ""}
            onClick={() => setPage("tags")}
          >
            By Tag
          </button>
        </nav>
      </header>
      <main className="app-main">
        {page === "tasks" && (
          <TaskDashboard
            tasks={tasks}
            loading={loading}
            filters={filters}
            allTags={allTags}
            onFiltersChange={handleFiltersChange}
            onRefresh={refresh}
          />
        )}
        {page === "chat" && <ChatPage onTasksCreated={refresh} />}
        {page === "tags" && (
          <TagGroupPage tasks={tasks} loading={loading} onRefresh={refresh} />
        )}
      </main>
    </div>
  );
}

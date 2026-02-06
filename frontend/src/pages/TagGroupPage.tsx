import type { Task } from "../types";
import TaskItem from "../components/TaskItem";

interface Props {
  tasks: Task[];
  loading: boolean;
  onRefresh: () => void;
}

export default function TagGroupPage({ tasks, loading, onRefresh }: Props) {
  // Group tasks by tag. Tasks with no tags go under "untagged".
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    if (task.tags.length === 0) {
      const arr = groups.get("untagged") ?? [];
      arr.push(task);
      groups.set("untagged", arr);
    } else {
      for (const tag of task.tags) {
        const arr = groups.get(tag) ?? [];
        arr.push(task);
        groups.set(tag, arr);
      }
    }
  }

  // Sort group keys: alphabetical, "untagged" at end
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === "untagged") return 1;
    if (b === "untagged") return -1;
    return a.localeCompare(b);
  });

  if (loading) {
    return (
      <div className="loading-center">
        <span className="spinner" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <p>No tasks yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Tasks by Tag</h2>
      {sortedKeys.map((tag) => {
        const tagTasks = groups.get(tag)!;
        return (
          <div key={tag} className="tag-group">
            <div className="tag-group-header">
              <span className="badge badge-tag" style={{ cursor: "default" }}>
                {tag}
              </span>
              <span className="tag-group-count">{tagTasks.length} tasks</span>
            </div>
            <div className="task-list">
              {tagTasks.map((t) => (
                <TaskItem
                  key={`${tag}-${t.id}`}
                  task={t}
                  onRefresh={onRefresh}
                  onEdit={() => {}}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import type { Task } from "../types";
import { updateTask, deleteTask } from "../api";
import { formatDateTime, isOverdue, isDueToday } from "../utils";

interface Props {
  task: Task;
  onRefresh: () => void;
  onEdit: (task: Task) => void;
  onTagClick?: (tag: string) => void;
}

export default function TaskItem({ task, onRefresh, onEdit, onTagClick }: Props) {
  const overdue = isOverdue(task.due_at, task.is_complete);
  const today = isDueToday(task.due_at);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await updateTask(task.id, { is_complete: !task.is_complete });
    onRefresh();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this task?")) return;
    await deleteTask(task.id);
    onRefresh();
  };

  const classes = [
    "task-item",
    task.is_complete ? "completed" : "",
    overdue ? "overdue" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} onClick={() => onEdit(task)}>
      <input
        type="checkbox"
        className="task-checkbox"
        checked={task.is_complete}
        onClick={handleToggle}
        onChange={() => {}}
      />
      <div className="task-info">
        <div className="task-name">{task.name}</div>
        <div className="task-meta">
          <span className={`badge badge-priority-${task.priority}`}>
            {task.priority}
          </span>
          {task.due_at && (
            <span
              className={`badge ${
                overdue
                  ? "badge-overdue"
                  : today
                  ? "badge-due-today"
                  : ""
              }`}
            >
              {overdue ? "Overdue: " : ""}
              {formatDateTime(task.due_at)}
            </span>
          )}
          {task.source === "chat" && (
            <span className="badge badge-chat">chat</span>
          )}
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="badge badge-tag"
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(tag);
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="task-actions">
        <button className="btn-icon" onClick={handleDelete} title="Delete">
          &#x2715;
        </button>
      </div>
    </div>
  );
}

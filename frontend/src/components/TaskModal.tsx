import { useState, useEffect } from "react";
import type { Task, TaskCreate, TaskUpdate, Priority } from "../types";
import { createTask, updateTask } from "../api";
import { toLocalInputValue } from "../utils";

interface Props {
  task: Task | null; // null = create mode
  onClose: () => void;
  onSaved: () => void;
}

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

export default function TaskModal({ task, onClose, onSaved }: Props) {
  const isEdit = !!task;

  const [name, setName] = useState(task?.name ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [tagsStr, setTagsStr] = useState(task?.tags.join(", ") ?? "");
  const [dueAt, setDueAt] = useState(toLocalInputValue(task?.due_at ?? null));
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const tags = tagsStr
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const dueAtVal = dueAt ? new Date(dueAt).toISOString() : null;

    try {
      if (isEdit) {
        const update: TaskUpdate = {
          name: name.trim(),
          description: description.trim() || null,
          notes: notes.trim() || null,
          tags,
          due_at: dueAtVal,
          priority,
        };
        await updateTask(task.id, update);
      } else {
        const create: TaskCreate = {
          name: name.trim(),
          description: description.trim() || null,
          notes: notes.trim() || null,
          tags,
          due_at: dueAtVal,
          priority,
        };
        await createTask(create);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? "Edit Task" : "New Task"}</h2>
          <button className="btn-icon" onClick={onClose}>
            &#x2715;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What needs to be done?"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              rows={2}
            />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes..."
              rows={2}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Tags (comma separated)</label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="e.g. work, urgent, project-x"
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              {saving ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

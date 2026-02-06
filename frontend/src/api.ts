import type {
  Task,
  TaskCreate,
  TaskUpdate,
  TaskFilters,
  ChatParseResponse,
  TaskProposal,
  ChatCommitResponse,
} from "./types";

const BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

// --- Tasks ---

export async function fetchTasks(filters?: TaskFilters): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.q) params.set("q", filters.q);
    if (filters.tag) params.set("tag", filters.tag);
    if (filters.is_complete !== null && filters.is_complete !== undefined)
      params.set("is_complete", String(filters.is_complete));
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.due) params.set("due", filters.due);
    if (filters.sort) params.set("sort", filters.sort);
  }
  const qs = params.toString();
  return request<Task[]>(`/tasks${qs ? `?${qs}` : ""}`);
}

export async function fetchTask(id: string): Promise<Task> {
  return request<Task>(`/tasks/${id}`);
}

export async function createTask(data: TaskCreate): Promise<Task> {
  return request<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTask(id: string, data: TaskUpdate): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: string): Promise<void> {
  return request<void>(`/tasks/${id}`, { method: "DELETE" });
}

// --- Chat ---

export async function chatParse(text: string): Promise<ChatParseResponse> {
  return request<ChatParseResponse>("/chat/parse", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function chatCommit(
  proposals: TaskProposal[],
  rawInput?: string
): Promise<ChatCommitResponse> {
  return request<ChatCommitResponse>("/chat/commit", {
    method: "POST",
    body: JSON.stringify({ proposals, raw_input: rawInput }),
  });
}

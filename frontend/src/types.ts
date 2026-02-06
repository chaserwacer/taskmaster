export type Priority = "low" | "medium" | "high" | "urgent";
export type ScheduleType = "scheduled" | "unscheduled";
export type Source = "manual" | "chat";

export interface Task {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  due_at: string | null;
  priority: Priority;
  is_complete: boolean;
  source: Source;
  raw_input: string | null;
  schedule_type: ScheduleType;
}

export interface TaskCreate {
  name: string;
  description?: string | null;
  notes?: string | null;
  tags?: string[];
  due_at?: string | null;
  priority?: Priority;
  is_complete?: boolean;
}

export interface TaskUpdate {
  name?: string;
  description?: string | null;
  notes?: string | null;
  tags?: string[];
  due_at?: string | null;
  priority?: Priority;
  is_complete?: boolean;
}

export interface TaskProposal {
  name: string;
  description: string | null;
  notes: string | null;
  tags: string[];
  due_at: string | null;
  priority: Priority;
  is_complete: boolean;
  confidence: number;
  assumptions: string[];
  requires_user_confirmation: boolean;
}

export interface ChatParseResponse {
  proposals: TaskProposal[];
  warnings: string[];
}

export interface ChatCommitResponse {
  created: Task[];
}

export interface TaskFilters {
  q?: string;
  tag?: string;
  is_complete?: boolean | null;
  priority?: Priority | null;
  due?: "overdue" | "today" | "upcoming" | "none" | null;
  sort?: "due_at" | "created_at" | "priority" | null;
}

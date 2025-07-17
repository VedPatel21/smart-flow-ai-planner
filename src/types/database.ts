export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type RecurrenceType = 'Daily' | 'Weekly' | 'Monthly' | 'Custom';
export type TaskStatus = 'Pending' | 'Completed' | 'Overdue';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority_level: PriorityLevel;
  category_id?: string;
  tags?: string[];
  is_recurring: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  estimated_duration?: number;
  status: TaskStatus;
  completed_at?: string;
  ai_priority_score: number;
  parent_task_id?: string;
  created_at: string;
  updated_at: string;
  category?: Category;
  subtasks?: Task[];
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TaskCompletion {
  id: string;
  user_id: string;
  task_id: string;
  completed_at: string;
  actual_duration?: number;
  completion_date: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  preferred_work_hours: {
    start: string;
    end: string;
  };
  daily_task_limit: number;
  ai_suggestions_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name?: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}
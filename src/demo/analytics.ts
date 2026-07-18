import { TaskCompletion } from "@/types/database";

const dateFor = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

export const demoTaskCompletions: TaskCompletion[] = [
  {
    id: "demo-completion-analytics",
    user_id: "demo-user-ved-patel",
    task_id: "demo-task-analytics",
    completed_at: dateFor(1),
    completion_date: dateFor(1),
    actual_duration: 42,
  },
  {
    id: "demo-completion-wireframe",
    user_id: "demo-user-ved-patel",
    task_id: "demo-task-wireframe",
    completed_at: dateFor(2),
    completion_date: dateFor(2),
    actual_duration: 55,
  },
  {
    id: "demo-completion-tests",
    user_id: "demo-user-ved-patel",
    task_id: "demo-task-tests",
    completed_at: dateFor(3),
    completion_date: dateFor(3),
    actual_duration: 70,
  },
];

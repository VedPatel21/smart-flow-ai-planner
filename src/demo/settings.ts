import { Category, UserPreferences } from "@/types/database";

export const demoCategories: Category[] = [
  { id: "demo-category-product", user_id: "demo-user-ved-patel", name: "Product", color: "#2563eb", created_at: new Date().toISOString() },
  { id: "demo-category-engineering", user_id: "demo-user-ved-patel", name: "Engineering", color: "#16a34a", created_at: new Date().toISOString() },
  { id: "demo-category-meetings", user_id: "demo-user-ved-patel", name: "Meetings", color: "#9333ea", created_at: new Date().toISOString() },
  { id: "demo-category-ops", user_id: "demo-user-ved-patel", name: "Operations", color: "#f59e0b", created_at: new Date().toISOString() },
  { id: "demo-category-career", user_id: "demo-user-ved-patel", name: "Career", color: "#dc2626", created_at: new Date().toISOString() },
];

export const demoUserPreferences: UserPreferences = {
  id: "demo-preferences-ved",
  user_id: "demo-user-ved-patel",
  preferred_work_hours: { start: "09:00", end: "17:00" },
  daily_task_limit: 8,
  ai_suggestions_enabled: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

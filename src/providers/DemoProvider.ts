import { demoTaskCompletions } from "@/demo/analytics";
import { demoUserPreferences } from "@/demo/settings";
import { demoTasks } from "@/demo/tasks";
import { demoUser } from "@/demo/auth";
import { demoCategories } from "@/demo/settings";

type TableName = "tasks" | "categories" | "task_completions" | "user_preferences";
type Store = Record<TableName, any[]>;
type Filter = { column: string; operator: "eq" | "neq" | "gte" | "lte"; value: any };

const STORAGE_KEY = "smart-taskflow-demo-store";

const initialStore = (): Store => ({
  tasks: demoTasks,
  categories: demoCategories,
  task_completions: demoTaskCompletions,
  user_preferences: [demoUserPreferences],
});

const readStore = (): Store => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...initialStore(), ...JSON.parse(stored) } : initialStore();
  } catch {
    return initialStore();
  }
};

const writeStore = (store: Store) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

const createId = (table: string) => `demo-${table}-${crypto.randomUUID?.() || Date.now()}`;

const withRelations = (table: TableName, row: any, store: Store) => {
  if (table !== "tasks") return row;
  return {
    ...row,
    category: row.category_id
      ? store.categories.find((category) => category.id === row.category_id) || null
      : null,
  };
};

const matches = (row: any, filter: Filter) => {
  const value = row[filter.column];
  switch (filter.operator) {
    case "eq":
      return value === filter.value;
    case "neq":
      return value !== filter.value;
    case "gte":
      return value >= filter.value;
    case "lte":
      return value <= filter.value;
  }
};

class DemoQueryBuilder {
  private filters: Filter[] = [];
  private orderBy?: { column: string; ascending: boolean };
  private wantsSingle = false;
  private mutation?: { type: "insert" | "update" | "delete"; payload?: any };

  constructor(private table: TableName) {}

  select() {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column, operator: "neq", value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ column, operator: "gte", value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ column, operator: "lte", value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  single() {
    this.wantsSingle = true;
    return this;
  }

  insert(payload: any) {
    this.mutation = { type: "insert", payload };
    return this;
  }

  update(payload: any) {
    this.mutation = { type: "update", payload };
    return this;
  }

  delete() {
    this.mutation = { type: "delete" };
    return this;
  }

  then(resolve: (value: any) => void, reject?: (reason: any) => void) {
    return this.execute().then(resolve, reject);
  }

  private async execute() {
    const store = readStore();
    const tableRows = store[this.table] || [];
    const now = new Date().toISOString();

    if (this.mutation?.type === "insert") {
      const payloads = Array.isArray(this.mutation.payload) ? this.mutation.payload : [this.mutation.payload];
      const rows = payloads.map((payload) => ({
        ...payload,
        id: payload.id || createId(this.table),
        status: payload.status || (this.table === "tasks" ? "Pending" : undefined),
        ai_priority_score:
          payload.ai_priority_score ?? (this.table === "tasks" ? scoreTask(payload.priority_level) : undefined),
        created_at: payload.created_at || now,
        updated_at: payload.updated_at || now,
        completed_at: payload.completed_at,
        completion_date: payload.completion_date || now,
      }));
      store[this.table] = [...tableRows, ...rows];
      writeStore(store);
      return { data: Array.isArray(this.mutation.payload) ? rows : rows[0], error: null };
    }

    if (this.mutation?.type === "update") {
      const updated = tableRows.map((row) =>
        this.filters.every((filter) => matches(row, filter))
          ? { ...row, ...this.mutation?.payload, updated_at: now }
          : row
      );
      store[this.table] = updated;
      writeStore(store);
      return { data: null, error: null };
    }

    if (this.mutation?.type === "delete") {
      store[this.table] = tableRows.filter((row) => !this.filters.every((filter) => matches(row, filter)));
      writeStore(store);
      return { data: null, error: null };
    }

    let rows = tableRows.filter((row) => this.filters.every((filter) => matches(row, filter)));
    if (this.orderBy) {
      rows = [...rows].sort((a, b) => {
        const left = a[this.orderBy!.column] ?? 0;
        const right = b[this.orderBy!.column] ?? 0;
        return this.orderBy!.ascending ? left - right : right - left;
      });
    }

    const data = rows.map((row) => withRelations(this.table, row, store));
    if (this.wantsSingle) {
      return data[0]
        ? { data: data[0], error: null }
        : { data: null, error: { code: "PGRST116", message: "No rows found" } };
    }

    return { data, error: null };
  }
}

const scoreTask = (priority?: string) => {
  if (priority === "Critical") return 9.5;
  if (priority === "High") return 8;
  if (priority === "Medium") return 5.5;
  return 3;
};

export const DemoProvider = {
  mode: "demo" as const,
  auth: {
    async getSession() {
      return { data: { session: demoSessionFromStorage() }, error: null };
    },
    onAuthStateChange(callback: (_event: string, session: any) => void) {
      window.setTimeout(() => callback("SIGNED_IN", demoSessionFromStorage()), 0);
      return { data: { subscription: { unsubscribe: () => undefined } } };
    },
    async signInWithPassword() {
      localStorage.setItem("smart-taskflow-demo-authenticated", "true");
      return { data: { user: demoUser, session: demoSessionFromStorage() }, error: null };
    },
    async signUp() {
      localStorage.setItem("smart-taskflow-demo-authenticated", "true");
      return { data: { user: demoUser, session: demoSessionFromStorage() }, error: null };
    },
    async signOut() {
      localStorage.removeItem("smart-taskflow-demo-authenticated");
      return { error: null };
    },
  },
  from(table: TableName) {
    return new DemoQueryBuilder(table);
  },
};

const demoSessionFromStorage = () => ({
  access_token: "demo-access-token",
  refresh_token: "demo-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: demoUser,
});

import { getActiveDataProvider } from "@/providers/DataProvider";

export const typedSupabase = {
  from(table: any) {
    return getActiveDataProvider().from(table);
  },
} as any;

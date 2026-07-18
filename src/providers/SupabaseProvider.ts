import { supabase } from "@/integrations/supabase/client";

export const SupabaseProvider = {
  mode: "supabase" as const,
  auth: supabase.auth,
  from: supabase.from.bind(supabase),
};

export const canUseSupabase = async () => {
  try {
    const [sessionResult, databaseResult] = await Promise.all([
      supabase.auth.getSession(),
      supabase.from("categories").select("id").limit(1),
    ]);
    return !sessionResult.error && !databaseResult.error;
  } catch {
    return false;
  }
};

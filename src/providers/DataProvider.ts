import { createContext, createElement, ReactNode, useContext, useEffect, useState } from "react";
import { DemoProvider } from "./DemoProvider";
import { canUseSupabase, SupabaseProvider } from "./SupabaseProvider";

type BackendMode = "checking" | "supabase" | "demo";

const DataProviderContext = createContext({
  mode: "checking" as BackendMode,
  isDemoMode: false,
});

let activeProvider: typeof DemoProvider | typeof SupabaseProvider = DemoProvider;
let activeMode: Exclude<BackendMode, "checking"> = "demo";

export const getActiveDataProvider = () => activeProvider;
export const getActiveBackendMode = () => activeMode;
export const forceDemoMode = () => {
  activeProvider = DemoProvider;
  activeMode = "demo";
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<BackendMode>("checking");

  useEffect(() => {
    let mounted = true;

    canUseSupabase().then((available) => {
      activeProvider = available ? SupabaseProvider : DemoProvider;
      activeMode = available ? "supabase" : "demo";
      if (mounted) setMode(activeMode);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return createElement(
    DataProviderContext.Provider,
    { value: { mode, isDemoMode: mode === "demo" } },
    mode === "checking"
      ? createElement("div", { className: "min-h-screen flex items-center justify-center" }, "Loading...")
      : children
  );
};

export const useDataProvider = () => useContext(DataProviderContext);

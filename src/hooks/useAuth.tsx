import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { demoSession, demoUser } from "@/demo/auth";
import { forceDemoMode, getActiveDataProvider } from "@/providers/DataProvider";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const provider = getActiveDataProvider();
    const authenticateDemoUser = () => {
      forceDemoMode();
      setSession(demoSession);
      setUser(demoUser);
      setLoading(false);
    };

    const { data: { subscription } } = provider.auth.onAuthStateChange(
      (event, session) => {
        setSession(session || demoSession);
        setUser(session?.user ?? demoUser);
        setLoading(false);
      }
    );

    provider.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session || demoSession);
        setUser(session?.user ?? demoUser);
        setLoading(false);
      })
      .catch(authenticateDemoUser);

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await getActiveDataProvider().auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { error: null };
    } catch {
      forceDemoMode();
      setSession(demoSession);
      setUser(demoUser);
      return { error: null };
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    try {
      const { error } = await getActiveDataProvider().auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName || email.split('@')[0]
          }
        }
      });
      if (error) throw error;
      return { error: null };
    } catch {
      forceDemoMode();
      setSession(demoSession);
      setUser(demoUser);
      return { error: null };
    }
  };

  const signOut = async () => {
    await getActiveDataProvider().auth.signOut();
    setSession(demoSession);
    setUser(demoUser);
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

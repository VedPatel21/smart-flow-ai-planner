import { Session, User } from "@supabase/supabase-js";
import { demoUserProfile } from "./users";

export const demoUser = {
  id: demoUserProfile.id,
  aud: "authenticated",
  role: "authenticated",
  email: demoUserProfile.email,
  email_confirmed_at: new Date().toISOString(),
  phone: "",
  app_metadata: { provider: "demo", providers: ["demo"] },
  user_metadata: {
    display_name: demoUserProfile.full_name,
    full_name: demoUserProfile.full_name,
    avatar_url: demoUserProfile.avatar,
    role: demoUserProfile.role,
  },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as User;

export const demoSession = {
  access_token: "demo-access-token",
  refresh_token: "demo-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: demoUser,
} as Session;

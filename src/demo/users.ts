export interface DemoUserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar: string;
  role: string;
  company: string;
  timezone: string;
}

export const demoUserProfile: DemoUserProfile = {
  id: "demo-user-ved-patel",
  email: "demo@example.com",
  full_name: "Ved Patel",
  avatar:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
  role: "Premium User",
  company: "Northstar Labs",
  timezone: "America/New_York",
};

export const getDemoUserProfile = () => ({ ...demoUserProfile });

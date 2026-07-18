import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, BarChart3, Target, Clock } from "lucide-react";
import TaskManager from "@/components/TaskManager";
import DailyPlanner from "@/components/DailyPlanner";
import Analytics from "@/components/Analytics";
import DashboardOverview from "@/components/DashboardOverview";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground text-sm md:text-base">
            Manage your tasks and optimize your productivity with AI
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="overview" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-2.5">
            <Target className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Home</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-2.5">
            <Clock className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Task Manager</span>
            <span className="sm:hidden">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="planner" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-2.5">
            <CalendarDays className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Daily Planner</span>
            <span className="sm:hidden">Planner</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-2.5">
            <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Analytics</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <DashboardOverview />
        </TabsContent>

        <TabsContent value="tasks">
          <TaskManager />
        </TabsContent>

        <TabsContent value="planner">
          <DailyPlanner />
        </TabsContent>

        <TabsContent value="analytics">
          <Analytics />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
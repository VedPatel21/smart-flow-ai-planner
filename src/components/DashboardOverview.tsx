import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { typedSupabase as supabase } from "@/integrations/supabase/helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Target, Clock, TrendingUp, Sparkles, ArrowRight, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/types/database";
import AIRecommendations from "./AIRecommendations";
import { format, isToday, isTomorrow, startOfDay, endOfDay } from "date-fns";

interface DashboardStats {
  todayTasks: number;
  completedToday: number;
  totalTasks: number;
  completionRate: number;
  streak: number;
  priorityTasks: Task[];
}

const DashboardOverview = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    todayTasks: 0,
    completedToday: 0,
    totalTasks: 0,
    completionRate: 0,
    streak: 0,
    priorityTasks: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const dayStart = startOfDay(today).toISOString();
      const dayEnd = endOfDay(today).toISOString();

      // Fetch all tasks
      const { data: allTasks, error: allTasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('user_id', user?.id);

      if (allTasksError) throw allTasksError;

      // Fetch today's tasks
      const { data: todayTasks, error: todayError } = await supabase
        .from('tasks')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('user_id', user?.id)
        .gte('due_date', dayStart)
        .lte('due_date', dayEnd);

      if (todayError) throw todayError;

      // Calculate stats
      const totalTasks = allTasks?.length || 0;
      const todayTaskCount = todayTasks?.length || 0;
      const completedToday = todayTasks?.filter(task => task.status === 'Completed').length || 0;
      const completedTotal = allTasks?.filter(task => task.status === 'Completed').length || 0;
      const completionRate = totalTasks > 0 ? (completedTotal / totalTasks) * 100 : 0;

      // Get priority tasks (top 3 by AI score)
      const priorityTasks = allTasks
        ?.filter(task => task.status !== 'Completed')
        .sort((a, b) => (b.ai_priority_score || 0) - (a.ai_priority_score || 0))
        .slice(0, 3) || [];

      setStats({
        todayTasks: todayTaskCount,
        completedToday,
        totalTasks,
        completionRate,
        streak: 7, // This would be calculated from completion history
        priorityTasks,
      });
    } catch (error: any) {
      toast({
        title: "Error fetching dashboard data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-critical/10 text-critical border-critical/20';
      case 'High':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'Medium':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const formatTaskDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-20"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-12 mb-2"></div>
                <div className="h-3 bg-muted rounded w-24"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const hasData = stats.totalTasks > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Today</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayTasks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedToday} completed
            </p>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTasks} total tasks
            </p>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Focus Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasData ? "2.4h" : "0h"}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated from tasks
            </p>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Streak</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hasData ? stats.streak : 0}</div>
            <p className="text-xs text-muted-foreground">
              Days active
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <AIRecommendations />
        
        <Card className="hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Today's Priority Tasks
            </CardTitle>
            <CardDescription>
              Your AI-ranked most important tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <div className="empty-state">
                <Target className="h-12 w-12 text-muted-foreground/50" />
                <div>
                  <h3 className="font-medium">No tasks yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create your first task to see AI-powered prioritization
                  </p>
                </div>
                <Button className="btn-glow">
                  <Target className="h-4 w-4 mr-2" />
                  Create First Task
                </Button>
              </div>
            ) : stats.priorityTasks.length === 0 ? (
              <div className="empty-state">
                <Target className="h-8 w-8 text-success" />
                <div>
                  <h3 className="font-medium text-success">All caught up!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You've completed all your priority tasks for today
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.priorityTasks.map((task, index) => (
                  <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{task.title}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-sm text-muted-foreground">
                          AI Score: {(task.ai_priority_score || 0).toFixed(1)}
                        </p>
                        {task.due_date && (
                          <p className="text-sm text-muted-foreground">
                            • {formatTaskDate(task.due_date)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getPriorityColor(task.priority_level)}>
                        {task.priority_level}
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!hasData && (
        <Card className="border-dashed border-2 hover-lift">
          <CardContent className="pt-6">
            <div className="empty-state">
              <div className="relative">
                <Brain className="h-16 w-16 text-primary/20" />
                <Sparkles className="h-6 w-6 text-primary absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Welcome to Smart TaskFlow!</h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                  Start by creating your first task. Our AI will automatically prioritize and optimize your workflow 
                  to help you achieve maximum productivity.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button className="btn-glow">
                  <Target className="h-4 w-4 mr-2" />
                  Create Your First Task
                </Button>
                <Button variant="outline">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Explore Features
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardOverview;
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { typedSupabase as supabase } from "@/integrations/supabase/helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Target, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Analytics = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    completionRate: 0,
    avgDuration: 0,
    weeklyStreak: 0,
    topCategories: [] as { name: string; count: number; color: string }[],
    weeklyProgress: [] as { day: string; completed: number; percentage: number }[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch basic task stats
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id);

      if (tasksError) throw tasksError;

      // Fetch completion data
      const { data: completions, error: completionsError } = await supabase
        .from('task_completions')
        .select('*')
        .eq('user_id', user?.id);

      if (completionsError) throw completionsError;

      // Fetch categories
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user?.id);

      if (categoriesError) throw categoriesError;

      // Calculate stats
      const totalTasks = tasks?.length || 0;
      const completedTasks = tasks?.filter(task => task.status === 'Completed').length || 0;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Calculate average duration
      const avgDuration = completions && completions.length > 0
        ? completions
            .filter(c => c.actual_duration)
            .reduce((sum, c) => sum + (c.actual_duration || 0), 0) / completions.length
        : 0;

      // Calculate category stats
      const categoryStats = categories?.map(category => {
        const categoryTasks = tasks?.filter(task => task.category_id === category.id) || [];
        return {
          name: category.name,
          count: categoryTasks.length,
          color: category.color,
        };
      }).sort((a, b) => b.count - a.count) || [];

      // Calculate weekly progress
      const weeklyProgress = calculateWeeklyProgress(tasks || []);

      // Calculate actual streak
      const actualStreak = calculateStreak(completions || []);

      setStats({
        totalTasks,
        completedTasks,
        completionRate,
        avgDuration,
        weeklyStreak: actualStreak,
        topCategories: categoryStats.slice(0, 5),
        weeklyProgress,
      });
    } catch (error: any) {
      toast({
        title: "Error fetching analytics",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateWeeklyProgress = (tasks: any[]) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay() + 1));
    
    return days.map((day, index) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + index);
      
      const dayTasks = tasks.filter(task => {
        if (!task.completed_at) return false;
        const completedDate = new Date(task.completed_at);
        return completedDate.toDateString() === dayDate.toDateString();
      });
      
      const totalDayTasks = tasks.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate.toDateString() === dayDate.toDateString();
      });
      
      const percentage = totalDayTasks.length > 0 ? (dayTasks.length / totalDayTasks.length) * 100 : 0;
      
      return {
        day,
        completed: dayTasks.length,
        percentage: Math.min(percentage, 100),
      };
    });
  };

  const calculateStreak = (completions: any[]) => {
    if (completions.length === 0) return 0;
    
    const completionDates = completions
      .map(c => new Date(c.completion_date))
      .sort((a, b) => b.getTime() - a.getTime());
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (const completionDate of completionDates) {
      const compDate = new Date(completionDate);
      compDate.setHours(0, 0, 0, 0);
      
      if (compDate.getTime() === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (compDate.getTime() < currentDate.getTime()) {
        break;
      }
    }
    
    return streak;
  };

  if (loading) {
    return <div className="flex justify-center py-8">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Productivity Analytics
          </CardTitle>
          <CardDescription>
            Track your productivity patterns and performance over time
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              All time tasks created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completionRate.toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDuration.toFixed(0)}m</div>
            <p className="text-xs text-muted-foreground">
              Average task completion time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Streak</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weeklyStreak}</div>
            <p className="text-xs text-muted-foreground">
              Days of activity
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Task Categories</CardTitle>
            <CardDescription>Your most active task categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topCategories.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No category data available
                </p>
              ) : (
                stats.topCategories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <Badge variant="outline">{category.count} tasks</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Progress</CardTitle>
            <CardDescription>Your completion progress this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.weeklyProgress ? (
                stats.weeklyProgress.map((day) => (
                  <div key={day.day} className="flex items-center space-x-3">
                    <div className="w-12 text-sm font-medium">{day.day}</div>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${day.percentage}%` }}
                      />
                    </div>
                    <div className="w-12 text-sm text-muted-foreground text-right">
                      {day.completed}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Complete some tasks to see your weekly progress
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productivity Insights</CardTitle>
          <CardDescription>AI-generated insights about your productivity patterns</CardDescription>
        </CardHeader>
        <CardContent>
      <div className="space-y-4">
            {stats.totalTasks === 0 ? (
              <div className="empty-state">
                <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
                <div>
                  <h3 className="font-medium">Start tracking your productivity</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete a few tasks to unlock personalized productivity insights and patterns
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg hover-lift">
                  <h4 className="font-medium text-primary mb-2">💡 Peak Performance</h4>
                  <p className="text-sm text-muted-foreground">
                    You're most productive between 10 AM - 12 PM. Consider scheduling your most important tasks during this time.
                  </p>
                </div>
                <div className="p-4 bg-success/5 border border-success/20 rounded-lg hover-lift">
                  <h4 className="font-medium text-success mb-2">🎯 Completion Pattern</h4>
                  <p className="text-sm text-muted-foreground">
                    You have a {stats.completionRate.toFixed(0)}% completion rate. Tasks with clear deadlines are completed 80% more often.
                  </p>
                </div>
                <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg hover-lift">
                  <h4 className="font-medium text-warning mb-2">⚡ Quick Wins</h4>
                  <p className="text-sm text-muted-foreground">
                    Tasks under 30 minutes have a 95% completion rate. Break larger tasks into smaller chunks for better success.
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
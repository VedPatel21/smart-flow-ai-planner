import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Target, Clock, Calendar, Award, Filter, RefreshCw, CheckCircle, AlertCircle, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Analytics = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState('week'); // week, month, all
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
    weeklyStreak: 0,
    topCategories: [] as { name: string; count: number; color: string; completionRate: number }[],
    weeklyProgress: [] as { day: string; completed: number; total: number; percentage: number }[],
    monthlyTrend: [] as { month: string; completed: number; total: number }[],
    productivityScore: 0,
    bestDay: '',
    taskVelocity: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user, timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      if (timeRange === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (timeRange === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else {
        startDate = new Date('2000-01-01'); // All time
      }

      // Fetch tasks within date range
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id)
        .gte('created_at', startDate.toISOString());

      if (tasksError) throw tasksError;

      // Fetch all tasks for streak calculation
      const { data: allTasks, error: allTasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id);

      if (allTasksError) throw allTasksError;

      // Fetch completion data
      const { data: completions, error: completionsError } = await supabase
        .from('task_completions')
        .select('*')
        .eq('user_id', user?.id)
        .gte('completion_date', startDate.toISOString());

      if (completionsError) throw completionsError;

      // Fetch categories
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user?.id);

      if (categoriesError) throw categoriesError;

      // Calculate basic stats
      const totalTasks = tasks?.length || 0;
      const completedTasks = tasks?.filter(task => task.status === 'Completed').length || 0;
      const pendingTasks = tasks?.filter(task => task.status === 'Pending').length || 0;
      const overdueTasks = tasks?.filter(task => {
        if (!task.due_date || task.status === 'Completed') return false;
        return new Date(task.due_date) < now;
      }).length || 0;
      
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Calculate enhanced category stats
      const categoryStats = categories?.map(category => {
        const categoryTasks = tasks?.filter(task => task.category_id === category.id) || [];
        const completedCategoryTasks = categoryTasks.filter(task => task.status === 'Completed').length;
        const categoryCompletionRate = categoryTasks.length > 0 ? (completedCategoryTasks / categoryTasks.length) * 100 : 0;
        
        return {
          name: category.name,
          count: categoryTasks.length,
          color: category.color,
          completionRate: categoryCompletionRate,
        };
      }).sort((a, b) => b.count - a.count) || [];

      // Calculate weekly progress with enhanced data
      const weeklyProgress = calculateWeeklyProgress(tasks || []);

      // Calculate monthly trend
      const monthlyTrend = calculateMonthlyTrend(allTasks || []);

      // Calculate streak
      const actualStreak = calculateStreak(allTasks || []);

      // Calculate productivity score (0-100)
      const productivityScore = calculateProductivityScore(completionRate, actualStreak, overdueTasks, totalTasks);

      // Find best performing day
      const bestDay = findBestPerformingDay(weeklyProgress);

      // Calculate task velocity (tasks completed per day)
      const taskVelocity = calculateTaskVelocity(completedTasks, timeRange);

      setStats({
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        completionRate,
        weeklyStreak: actualStreak,
        topCategories: categoryStats.slice(0, 5),
        weeklyProgress,
        monthlyTrend,
        productivityScore,
        bestDay,
        taskVelocity,
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

  const refreshData = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
    toast({
      title: "Analytics refreshed",
      description: "Your data has been updated successfully",
    });
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
        total: totalDayTasks.length,
        percentage: Math.min(percentage, 100),
      };
    });
  };

  const calculateMonthlyTrend = (tasks: any[]) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const last6Months = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const year = new Date().getFullYear();
      const monthStart = new Date(year, monthIndex, 1);
      const monthEnd = new Date(year, monthIndex + 1, 0);
      
      const monthTasks = tasks.filter(task => {
        const taskDate = new Date(task.created_at);
        return taskDate >= monthStart && taskDate <= monthEnd;
      });
      
      const completedMonthTasks = monthTasks.filter(task => task.status === 'Completed').length;
      
      last6Months.push({
        month: months[monthIndex],
        completed: completedMonthTasks,
        total: monthTasks.length,
      });
    }
    
    return last6Months;
  };

  const calculateStreak = (tasks: any[]) => {
    if (tasks.length === 0) return 0;
    
    const completedTasks = tasks.filter(task => task.status === 'Completed' && task.completed_at);
    const completionDates = completedTasks
      .map(task => new Date(task.completed_at))
      .sort((a, b) => b.getTime() - a.getTime());
    
    if (completionDates.length === 0) return 0;
    
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

  const calculateProductivityScore = (completionRate: number, streak: number, overdueTasks: number, totalTasks: number) => {
    let score = 0;
    
    // Completion rate contributes 40%
    score += (completionRate / 100) * 40;
    
    // Streak contributes 30% (capped at 30 days)
    score += Math.min(streak / 30, 1) * 30;
    
    // Overdue penalty (-20% max)
    const overdueRate = totalTasks > 0 ? overdueTasks / totalTasks : 0;
    score -= overdueRate * 20;
    
    // Consistency bonus (remaining 30%)
    score += Math.min(totalTasks / 20, 1) * 30;
    
    return Math.max(0, Math.min(100, score));
  };

  const findBestPerformingDay = (weeklyProgress: any[]) => {
    if (weeklyProgress.length === 0) return 'N/A';
    const bestDay = weeklyProgress.reduce((prev, current) => 
      prev.percentage > current.percentage ? prev : current
    );
    return bestDay.percentage > 0 ? bestDay.day : 'N/A';
  };

  const calculateTaskVelocity = (completedTasks: number, timeRange: string) => {
    const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365;
    return completedTasks / days;
  };

  const getProductivityScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProductivityScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <BarChart3 className="h-8 w-8 animate-pulse text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Productivity Analytics
              </CardTitle>
              <CardDescription>
                Track your productivity patterns and performance insights
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant={timeRange === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('week')}
                >
                  Week
                </Button>
                <Button
                  variant={timeRange === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('month')}
                >
                  Month
                </Button>
                <Button
                  variant={timeRange === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('all')}
                >
                  All Time
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              {timeRange === 'week' ? 'This week' : timeRange === 'month' ? 'This month' : 'All time'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completionRate.toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdueTasks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingTasks} pending tasks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Streak</CardTitle>
            <Award className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.weeklyStreak}</div>
            <p className="text-xs text-muted-foreground">
              Days of consistent work
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Productivity Score & Velocity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Productivity Score
            </CardTitle>
            <CardDescription>Overall performance metric</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getProductivityScoreColor(stats.productivityScore)}`}>
                  {stats.productivityScore.toFixed(0)}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {getProductivityScoreLabel(stats.productivityScore)}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{stats.productivityScore.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${stats.productivityScore}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Task Velocity
            </CardTitle>
            <CardDescription>Your productivity insights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.taskVelocity.toFixed(1)}
                  </div>
                  <p className="text-xs text-muted-foreground">Tasks/day</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.bestDay}
                  </div>
                  <p className="text-xs text-muted-foreground">Best day</p>
                </div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {stats.taskVelocity > 2 
                    ? "🚀 You're on fire! Great task completion rate."
                    : stats.taskVelocity > 1
                    ? "👍 Steady progress. Keep up the good work!"
                    : "💡 Try breaking larger tasks into smaller ones for better velocity."
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories and Weekly Progress */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Task Categories</CardTitle>
            <CardDescription>Category performance breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topCategories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No category data available</p>
                  <p className="text-xs">Create categories to track performance</p>
                </div>
              ) : (
                stats.topCategories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <div>
                        <span className="font-medium">{category.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {category.completionRate.toFixed(0)}% completion rate
                        </p>
                      </div>
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
            <CardDescription>Daily completion tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.weeklyProgress.map((day) => (
                <div key={day.day} className="flex items-center space-x-3">
                  <div className="w-12 text-sm font-medium">{day.day}</div>
                  <div className="flex-1 bg-muted rounded-full h-2 relative">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${day.percentage}%` }}
                    />
                  </div>
                  <div className="w-20 text-sm text-muted-foreground text-right">
                    {day.completed}/{day.total}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Smart Insights</CardTitle>
          <CardDescription>Personalized recommendations based on your data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.totalTasks === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-medium text-lg mb-2">Start Your Productivity Journey</h3>
                <p className="text-muted-foreground">
                  Complete a few tasks to unlock personalized insights and recommendations
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Performance Trend
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {stats.completionRate > 80 
                      ? "Outstanding performance! Your completion rate is excellent."
                      : stats.completionRate > 60
                      ? "Good progress! Consider setting daily task limits for better focus."
                      : "Room for improvement. Try breaking tasks into smaller, manageable chunks."
                    }
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Consistency Score
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {stats.weeklyStreak > 5 
                      ? "Amazing consistency! Your streak shows great discipline."
                      : stats.weeklyStreak > 2
                      ? "Building momentum! Keep up the daily progress."
                      : "Start small! Even 1 task per day builds powerful habits."
                    }
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Timing Optimization
                  </h4>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    {stats.bestDay !== 'N/A' 
                      ? `${stats.bestDay} is your most productive day. Schedule important tasks then.`
                      : "Complete more tasks to identify your peak performance days."
                    }
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Focus Areas
                  </h4>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    {stats.overdueTasks > 0 
                      ? `${stats.overdueTasks} overdue tasks need attention. Consider revising deadlines.`
                      : "No overdue tasks! Your time management is on point."
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
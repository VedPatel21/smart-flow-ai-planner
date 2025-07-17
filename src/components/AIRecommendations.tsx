import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Lightbulb, Clock, Target, TrendingUp, Calendar, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AIRecommendation {
  id: string;
  type: 'priority' | 'schedule' | 'break' | 'focus' | 'productivity' | 'planning';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  impact: 'low' | 'medium' | 'high';
}

const AIRecommendations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      generateRecommendations();
    }
  }, [user]);

  const generateRecommendations = async () => {
    try {
      setLoading(true);
      
      // Fetch user's tasks with more detailed information
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('user_id', user?.id);

      if (tasksError) throw tasksError;

      // Fetch user preferences
      const { data: preferences, error: preferencesError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (preferencesError && preferencesError.code !== 'PGRST116') throw preferencesError;

      const enhancedRecommendations = generateEnhancedRecommendations(tasks || [], preferences);
      setRecommendations(enhancedRecommendations);
    } catch (error: any) {
      toast({
        title: "Error generating recommendations",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateEnhancedRecommendations = (tasks: any[], preferences: any): AIRecommendation[] => {
    const recommendations: AIRecommendation[] = [];
    
    if (tasks.length === 0) {
      return [{
        id: 'start',
        type: 'planning',
        title: 'Start Your Productivity Journey',
        description: 'Begin by adding your first task to get personalized AI recommendations.',
        confidence: 100,
        actionable: true,
        urgency: 'medium',
        impact: 'high'
      }];
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Analyze task patterns and metrics
    const taskMetrics = analyzeTaskMetrics(tasks, now);
    
    // Generate recommendations based on comprehensive analysis
    recommendations.push(...generateUrgencyRecommendations(tasks, taskMetrics, now));
    recommendations.push(...generateProductivityRecommendations(tasks, taskMetrics, preferences));
    recommendations.push(...generateSchedulingRecommendations(tasks, taskMetrics, preferences));
    recommendations.push(...generateFocusRecommendations(tasks, taskMetrics, preferences));
    recommendations.push(...generatePlanningRecommendations(tasks, taskMetrics, preferences));

    // Sort by urgency and impact, then limit to top 5 most relevant
    return recommendations
      .sort((a, b) => {
        const urgencyScore = { critical: 4, high: 3, medium: 2, low: 1 };
        const impactScore = { high: 3, medium: 2, low: 1 };
        
        const scoreA = urgencyScore[a.urgency] * impactScore[a.impact] * (a.confidence / 100);
        const scoreB = urgencyScore[b.urgency] * impactScore[b.impact] * (b.confidence / 100);
        
        return scoreB - scoreA;
      })
      .slice(0, 5);
  };

  const analyzeTaskMetrics = (tasks: any[], now: Date) => {
    const completed = tasks.filter(t => t.status === 'Completed');
    const pending = tasks.filter(t => t.status !== 'Completed');
    const overdue = pending.filter(t => t.due_date && new Date(t.due_date) < now);
    const dueToday = pending.filter(t => {
      if (!t.due_date) return false;
      const taskDate = new Date(t.due_date);
      return taskDate.toDateString() === now.toDateString();
    });
    const dueTomorrow = pending.filter(t => {
      if (!t.due_date) return false;
      const taskDate = new Date(t.due_date);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return taskDate.toDateString() === tomorrow.toDateString();
    });

    const priorityDistribution = {
      critical: pending.filter(t => t.priority_level === 'Critical').length,
      high: pending.filter(t => t.priority_level === 'High').length,
      medium: pending.filter(t => t.priority_level === 'Medium').length,
      low: pending.filter(t => t.priority_level === 'Low').length
    };

    const unscheduled = pending.filter(t => !t.due_date);
    const completionRate = tasks.length > 0 ? (completed.length / tasks.length) * 100 : 0;
    
    // Calculate average time between task creation and completion
    const avgCompletionTime = completed.length > 0 ? 
      completed.reduce((sum, task) => {
        const created = new Date(task.created_at);
        const completed = new Date(task.updated_at);
        return sum + (completed.getTime() - created.getTime());
      }, 0) / completed.length : 0;

    return {
      totalTasks: tasks.length,
      completed: completed.length,
      pending: pending.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      dueTomorrow: dueTomorrow.length,
      unscheduled: unscheduled.length,
      priorityDistribution,
      completionRate,
      avgCompletionTime,
      overdueRatio: pending.length > 0 ? (overdue.length / pending.length) * 100 : 0
    };
  };

  const generateUrgencyRecommendations = (tasks: any[], metrics: any, now: Date): AIRecommendation[] => {
    const recommendations: AIRecommendation[] = [];

    // Critical: Overdue tasks
    if (metrics.overdue > 0) {
      const severity = metrics.overdue > 5 ? 'critical' : metrics.overdue > 2 ? 'high' : 'medium';
      recommendations.push({
        id: 'overdue',
        type: 'priority',
        title: `${metrics.overdue} Overdue Task${metrics.overdue > 1 ? 's' : ''} Need Attention`,
        description: `${metrics.overdue} task${metrics.overdue > 1 ? 's are' : ' is'} overdue. ${metrics.overdue > 3 ? 'Consider rescheduling or delegating some tasks.' : 'Address these immediately to prevent further delays.'}`,
        confidence: 95,
        actionable: true,
        urgency: severity as any,
        impact: 'high'
      });
    }

    // High: Critical priority tasks
    if (metrics.priorityDistribution.critical > 0) {
      recommendations.push({
        id: 'critical',
        type: 'priority',
        title: `${metrics.priorityDistribution.critical} Critical Task${metrics.priorityDistribution.critical > 1 ? 's' : ''} Awaiting`,
        description: `Focus on your ${metrics.priorityDistribution.critical} critical priority task${metrics.priorityDistribution.critical > 1 ? 's' : ''} first. These likely have the highest impact on your goals.`,
        confidence: 90,
        actionable: true,
        urgency: 'high',
        impact: 'high'
      });
    }

    // Medium: Today's heavy workload
    if (metrics.dueToday > 8) {
      recommendations.push({
        id: 'heavy_workload',
        type: 'schedule',
        title: 'Heavy Workload Today',
        description: `You have ${metrics.dueToday} tasks due today. Consider prioritizing the most important ones and rescheduling others to maintain quality.`,
        confidence: 85,
        actionable: true,
        urgency: 'medium',
        impact: 'medium'
      });
    }

    return recommendations;
  };

  const generateProductivityRecommendations = (tasks: any[], metrics: any, preferences: any): AIRecommendation[] => {
    const recommendations: AIRecommendation[] = [];

    // Low completion rate
    if (metrics.completionRate < 60 && metrics.totalTasks > 5) {
      recommendations.push({
        id: 'completion_rate',
        type: 'focus',
        title: 'Improve Task Completion Rate',
        description: `Your completion rate is ${metrics.completionRate.toFixed(0)}%. Try breaking larger tasks into smaller, achievable milestones or reviewing your task prioritization.`,
        confidence: 80,
        actionable: true,
        urgency: 'medium',
        impact: 'high'
      });
    }

    // High overdue ratio indicates planning issues
    if (metrics.overdueRatio > 30) {
      recommendations.push({
        id: 'planning_improvement',
        type: 'planning',
        title: 'Enhance Task Planning',
        description: `${metrics.overdueRatio.toFixed(0)}% of your pending tasks are overdue. Consider setting more realistic deadlines or building buffer time into your schedule.`,
        confidence: 75,
        actionable: true,
        urgency: 'medium',
        impact: 'high'
      });
    }

    // Productivity momentum
    if (metrics.completionRate > 80 && metrics.overdue === 0) {
      recommendations.push({
        id: 'momentum',
        type: 'productivity',
        title: 'Excellent Productivity Momentum',
        description: `You're on fire! ${metrics.completionRate.toFixed(0)}% completion rate with no overdue tasks. Consider taking on a challenging project or helping others.`,
        confidence: 95,
        actionable: true,
        urgency: 'low',
        impact: 'medium'
      });
    }

    return recommendations;
  };

  const generateSchedulingRecommendations = (tasks: any[], metrics: any, preferences: any): AIRecommendation[] => {
    const recommendations: AIRecommendation[] = [];

    // Too many unscheduled tasks
    if (metrics.unscheduled > 5) {
      recommendations.push({
        id: 'unscheduled',
        type: 'schedule',
        title: 'Schedule Your Unscheduled Tasks',
        description: `You have ${metrics.unscheduled} tasks without due dates. Research shows that scheduled tasks are 70% more likely to be completed. Set realistic deadlines for better productivity.`,
        confidence: 85,
        actionable: true,
        urgency: 'medium',
        impact: 'high'
      });
    }

    // Balanced workload suggestion
    if (metrics.dueToday === 0 && metrics.dueTomorrow === 0 && metrics.pending > 0) {
      recommendations.push({
        id: 'schedule_balance',
        type: 'schedule',
        title: 'Optimize Your Schedule',
        description: 'You have tasks but none scheduled for today or tomorrow. Distribute your workload across the coming days for better time management.',
        confidence: 70,
        actionable: true,
        urgency: 'low',
        impact: 'medium'
      });
    }

    // Weekend planning
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 5 && metrics.pending > 0) { // Friday
      recommendations.push({
        id: 'weekend_planning',
        type: 'planning',
        title: 'Plan Your Next Week',
        description: `It's Friday! Review your ${metrics.pending} pending tasks and plan your priorities for next week. A good plan sets you up for success.`,
        confidence: 80,
        actionable: true,
        urgency: 'low',
        impact: 'medium'
      });
    }

    return recommendations;
  };

  const generateFocusRecommendations = (tasks: any[], metrics: any, preferences: any): AIRecommendation[] => {
    const recommendations: AIRecommendation[] = [];

    // Priority imbalance
    const totalPriorityTasks = metrics.priorityDistribution.critical + metrics.priorityDistribution.high;
    const totalLowPriority = metrics.priorityDistribution.low + metrics.priorityDistribution.medium;
    
    if (totalLowPriority > totalPriorityTasks * 2 && totalPriorityTasks > 0) {
      recommendations.push({
        id: 'priority_focus',
        type: 'focus',
        title: 'Focus on High-Impact Tasks',
        description: `You have many low-priority tasks but ${totalPriorityTasks} high-impact ones waiting. Focus on completing high-priority tasks first for maximum productivity.`,
        confidence: 85,
        actionable: true,
        urgency: 'medium',
        impact: 'high'
      });
    }

    // Task batching suggestion
    if (metrics.dueToday > 3) {
      recommendations.push({
        id: 'batching',
        type: 'focus',
        title: 'Try Task Batching',
        description: `With ${metrics.dueToday} tasks today, consider grouping similar tasks together. This can improve focus and reduce context switching.`,
        confidence: 75,
        actionable: true,
        urgency: 'low',
        impact: 'medium'
      });
    }

    return recommendations;
  };

  const generatePlanningRecommendations = (tasks: any[], metrics: any, preferences: any): AIRecommendation[] => {
    const recommendations: AIRecommendation[] = [];

    // Time estimation improvement
    if (metrics.avgCompletionTime > 0) {
      const avgDays = Math.ceil(metrics.avgCompletionTime / (1000 * 60 * 60 * 24));
      if (avgDays > 7) {
        recommendations.push({
          id: 'time_estimation',
          type: 'planning',
          title: 'Improve Time Estimation',
          description: `Your tasks take an average of ${avgDays} days to complete. Consider breaking large tasks into smaller ones or setting more realistic deadlines.`,
          confidence: 70,
          actionable: true,
          urgency: 'low',
          impact: 'medium'
        });
      }
    }

    // Category diversification
    const categories = [...new Set(tasks.map(t => t.category?.name).filter(Boolean))];
    if (categories.length === 1 && tasks.length > 10) {
      recommendations.push({
        id: 'diversification',
        type: 'planning',
        title: 'Diversify Your Tasks',
        description: 'All your tasks are in one category. Consider organizing tasks into different categories for better management and work-life balance.',
        confidence: 65,
        actionable: true,
        urgency: 'low',
        impact: 'low'
      });
    }

    return recommendations;
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'priority':
        return <Target className="h-4 w-4" />;
      case 'schedule':
        return <Clock className="h-4 w-4" />;
      case 'break':
        return <Lightbulb className="h-4 w-4" />;
      case 'focus':
        return <Brain className="h-4 w-4" />;
      case 'productivity':
        return <TrendingUp className="h-4 w-4" />;
      case 'planning':
        return <Calendar className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-success/10 text-success border-success/20';
    if (confidence >= 80) return 'bg-primary/10 text-primary border-primary/20';
    if (confidence >= 70) return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-muted/10 text-muted-foreground border-muted/20';
  };

  const handleApplyRecommendation = async (recommendation: AIRecommendation) => {
    try {
      const actionMessages = {
        'overdue': "Navigate to your overdue tasks and prioritize them by impact and urgency.",
        'critical': "Focus on your critical priority tasks first - they likely have the highest impact.",
        'completion_rate': "Try the 'two-minute rule' - if a task takes less than 2 minutes, do it immediately.",
        'unscheduled': "Review your tasks and assign realistic due dates to improve completion rates.",
        'heavy_workload': "Consider which tasks can be rescheduled or delegated to maintain quality.",
        'planning_improvement': "Build buffer time into your schedules and set more realistic deadlines.",
        'momentum': "Great work! Consider taking on a challenging project or mentoring others.",
        'schedule_balance': "Distribute your workload across the coming days for better time management.",
        'priority_focus': "Complete high-priority tasks first for maximum productivity impact.",
        'batching': "Group similar tasks together to improve focus and reduce context switching.",
        'time_estimation': "Break large tasks into smaller, manageable subtasks with clearer deadlines.",
        'weekend_planning': "Review pending tasks and set priorities for the upcoming week.",
        'diversification': "Consider organizing tasks into different categories for better balance.",
        'start': "Click 'Add Task' to begin your productivity journey with Smart TaskFlow!"
      };

      toast({
        title: "Recommendation Applied",
        description: actionMessages[recommendation.id] || "This recommendation has been applied to your workflow.",
      });
    } catch (error: any) {
      toast({
        title: "Error applying recommendation",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Analyzing your productivity patterns...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Productivity Insights
            </CardTitle>
            <CardDescription>
              Intelligent recommendations based on your task patterns and productivity metrics
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={generateRecommendations}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.length === 0 ? (
            <div className="empty-state">
              <Brain className="h-8 w-8 text-muted-foreground/50" />
              <div>
                <h3 className="font-medium">Building your AI profile...</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add some tasks to receive personalized productivity insights and recommendations!
                </p>
              </div>
            </div>
          ) : (
            recommendations.map((rec) => (
              <div key={rec.id} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 mt-1">
                  {getRecommendationIcon(rec.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <h4 className="font-medium text-sm">{rec.title}</h4>
                    {rec.urgency === 'critical' && (
                      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 ml-2" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rec.description}</p>
                  <div className="flex items-center space-x-2 mt-3">
                    <Badge className={getUrgencyColor(rec.urgency)} variant="outline">
                      {rec.urgency} urgency
                    </Badge>
                    <Badge className={getConfidenceColor(rec.confidence)} variant="outline">
                      {rec.confidence}% confidence
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {rec.impact} impact
                    </Badge>
                  </div>
                </div>
                {rec.actionable && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleApplyRecommendation(rec)}
                    className="flex-shrink-0"
                  >
                    Apply
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AIRecommendations;
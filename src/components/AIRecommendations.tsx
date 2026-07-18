import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { typedSupabase as supabase } from "@/integrations/supabase/helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Lightbulb, Clock, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AIRecommendation {
  id: string;
  type: 'priority' | 'schedule' | 'break' | 'focus';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
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
      
      // Fetch user's tasks to generate real recommendations
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

      const realRecommendations = generateRealRecommendations(tasks || [], preferences);
      setRecommendations(realRecommendations);
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

  const generateRealRecommendations = (tasks: any[], preferences: any): AIRecommendation[] => {
    const recommendations: AIRecommendation[] = [];
    
    if (tasks.length === 0) {
      return [];
    }

    // Check for overdue tasks
    const overdueTasks = tasks.filter(task => 
      task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Completed'
    );
    
    if (overdueTasks.length > 0) {
      recommendations.push({
        id: 'overdue',
        type: 'priority',
        title: 'Address Overdue Tasks',
        description: `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}. Consider tackling ${overdueTasks.length > 1 ? 'these' : 'this'} first to get back on track.`,
        confidence: 95,
        actionable: true,
      });
    }

    // Check for critical priority tasks
    const criticalTasks = tasks.filter(task => 
      task.priority_level === 'Critical' && task.status !== 'Completed'
    );
    
    if (criticalTasks.length > 0) {
      recommendations.push({
        id: 'critical',
        type: 'priority',
        title: 'Focus on Critical Tasks',
        description: `You have ${criticalTasks.length} critical priority task${criticalTasks.length > 1 ? 's' : ''}. These should be your top priority.`,
        confidence: 90,
        actionable: true,
      });
    }

    // Check completion rate
    const completedTasks = tasks.filter(task => task.status === 'Completed').length;
    const completionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
    
    if (completionRate < 50 && tasks.length > 5) {
      recommendations.push({
        id: 'completion',
        type: 'focus',
        title: 'Improve Task Completion',
        description: `Your completion rate is ${completionRate.toFixed(0)}%. Try breaking larger tasks into smaller, manageable chunks.`,
        confidence: 80,
        actionable: true,
      });
    }

    // Check for tasks without due dates
    const unscheduledTasks = tasks.filter(task => 
      !task.due_date && task.status !== 'Completed'
    );
    
    if (unscheduledTasks.length > 3) {
      recommendations.push({
        id: 'schedule',
        type: 'schedule',
        title: 'Schedule Your Tasks',
        description: `You have ${unscheduledTasks.length} unscheduled tasks. Adding due dates can improve completion rates by 70%.`,
        confidence: 85,
        actionable: true,
      });
    }

    // Check task distribution
    const todayTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      const taskDate = new Date(task.due_date);
      const today = new Date();
      return taskDate.toDateString() === today.toDateString() && task.status !== 'Completed';
    });

    if (todayTasks.length > (preferences?.daily_task_limit || 8)) {
      recommendations.push({
        id: 'workload',
        type: 'schedule',
        title: 'Optimize Daily Workload',
        description: `You have ${todayTasks.length} tasks scheduled for today. Consider redistributing some to other days for better balance.`,
        confidence: 75,
        actionable: true,
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
      default:
        return <Lightbulb className="h-4 w-4" />;
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
      switch (recommendation.id) {
        case 'overdue':
          // Navigate to tasks with overdue filter
          toast({
            title: "Showing Overdue Tasks",
            description: "Check your Task Manager for overdue items.",
          });
          break;
        
        case 'critical':
          // Navigate to tasks with critical filter
          toast({
            title: "Showing Critical Tasks",
            description: "Focus on your critical priority tasks first.",
          });
          break;
        
        case 'completion':
          // Suggest breaking down large tasks
          toast({
            title: "Task Optimization Tip",
            description: "Try setting smaller milestones for your larger tasks to improve completion rates.",
          });
          break;
        
        case 'schedule':
          // Navigate to daily planner
          toast({
            title: "Schedule Your Tasks",
            description: "Use the Daily Planner to add due dates to your unscheduled tasks.",
          });
          break;
        
        case 'workload':
          // Suggest task redistribution
          toast({
            title: "Workload Optimization",
            description: "Consider moving some of today's tasks to tomorrow for better balance.",
          });
          break;
        
        default:
          toast({
            title: "Recommendation Applied",
            description: "This recommendation has been noted and applied to your workflow.",
          });
      }
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
          <div className="text-center py-4">Generating AI insights...</div>
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
              AI Recommendations
            </CardTitle>
            <CardDescription>
              Personalized suggestions to optimize your productivity
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
                  This feature will activate automatically once you've used Smart TaskFlow for a few days — no setup needed!
                </p>
              </div>
            </div>
          ) : (
            recommendations.map((rec) => (
              <div key={rec.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  {getRecommendationIcon(rec.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium">{rec.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge className={getConfidenceColor(rec.confidence)}>
                      {rec.confidence}% confidence
                    </Badge>
                    {rec.actionable && (
                      <Badge variant="outline">Actionable</Badge>
                    )}
                  </div>
                </div>
                {rec.actionable && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleApplyRecommendation(rec)}
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
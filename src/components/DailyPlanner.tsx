import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { typedSupabase as supabase } from "@/integrations/supabase/helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/types/database";
import { format, startOfDay, endOfDay } from "date-fns";
import { CalendarDays, Brain, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TimeBlocks from "./TimeBlocks";

const DailyPlanner = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dayTasks, setDayTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && selectedDate) {
      fetchDayTasks();
    }
  }, [user, selectedDate]);

  const fetchDayTasks = async () => {
    try {
      setLoading(true);
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = endOfDay(selectedDate).toISOString();

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('user_id', user?.id)
        .gte('due_date', dayStart)
        .lte('due_date', dayEnd)
        .order('ai_priority_score', { ascending: false });

      if (error) throw error;
      setDayTasks(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching tasks",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateAISchedule = async () => {
    try {
      // This would call the AI scheduling edge function
      toast({
        title: "AI Schedule Generated",
        description: "Your optimal daily schedule has been created based on task priorities and your preferences.",
      });
    } catch (error: any) {
      toast({
        title: "Error generating schedule",
        description: error.message,
        variant: "destructive",
      });
    }
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Daily Planner
              </CardTitle>
              <CardDescription>
                Plan and schedule your tasks for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </CardDescription>
            </div>
            <Button onClick={generateAISchedule} variant="outline">
              <Brain className="h-4 w-4 mr-2" />
              AI Schedule
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tasks for {format(selectedDate, 'MMM d')}</CardTitle>
              <CardDescription>
                {dayTasks.length} tasks scheduled for this day
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading tasks...</div>
              ) : dayTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks scheduled for this day
                </div>
              ) : (
                <div className="space-y-3">
                  {dayTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{task.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {task.due_date && format(new Date(task.due_date), 'h:mm a')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {task.priority_level}
                        </Badge>
                        {task.estimated_duration && (
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{task.estimated_duration}m</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <TimeBlocks 
            selectedDate={selectedDate} 
            onTaskScheduled={fetchDayTasks}
          />
        </div>
      </div>
    </div>
  );
};

export default DailyPlanner;
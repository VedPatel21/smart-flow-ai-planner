import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { typedSupabase as supabase } from "@/integrations/supabase/helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Filter, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Task, Category } from "@/types/database";
import TaskDialog from "./TaskDialog";
import TaskCard from "./TaskCard";

const TaskManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchCategories();
    }
  }, [user]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('user_id', user?.id)
        .order('ai_priority_score', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
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

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching categories",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTaskComplete = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: 'Completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      // Record completion
      await supabase
        .from('task_completions')
        .insert({
          user_id: user?.id,
          task_id: taskId,
        });

      fetchTasks();
      toast({
        title: "Task completed!",
        description: "Great job on finishing this task.",
      });
    } catch (error: any) {
      toast({
        title: "Error completing task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      fetchTasks();
      toast({
        title: "Task deleted",
        description: "The task has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || task.status.toLowerCase() === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'Overdue':
        return <AlertTriangle className="h-4 w-4 text-critical" />;
      default:
        return <Clock className="h-4 w-4 text-warning" />;
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

  if (loading) {
    return <div className="flex justify-center py-8">Loading tasks...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Task Manager</CardTitle>
              <CardDescription>
                Organize and manage all your tasks with AI-powered prioritization
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("all")}
              >
                All
              </Button>
              <Button
                variant={filterStatus === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("pending")}
              >
                Pending
              </Button>
              <Button
                variant={filterStatus === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("completed")}
              >
                Completed
              </Button>
              <Button
                variant={filterStatus === "overdue" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("overdue")}
              >
                Overdue
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || filterStatus !== "all" 
                  ? "No tasks match your filters" 
                  : "No tasks yet. Create your first task to get started!"}
              </div>
            ) : (
              filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={handleTaskComplete}
                  onEdit={(task) => {
                    setEditingTask(task);
                    setIsDialogOpen(true);
                  }}
                  onDelete={handleTaskDelete}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <TaskDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        task={editingTask}
        categories={categories}
        onTaskSaved={() => {
          fetchTasks();
          setIsDialogOpen(false);
          setEditingTask(null);
        }}
      />
    </div>
  );
};

export default TaskManager;
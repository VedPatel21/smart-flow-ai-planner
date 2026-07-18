import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { typedSupabase as supabase } from "@/integrations/supabase/helpers";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Task, Category, PriorityLevel, RecurrenceType } from "@/types/database";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  categories: Category[];
  onTaskSaved: () => void;
}

const TaskDialog = ({ open, onOpenChange, task, categories, onTaskSaved }: TaskDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority_level: 'Medium' as PriorityLevel,
    category_id: '',
    tags: '',
    is_recurring: false,
    recurrence_type: 'Daily' as RecurrenceType,
    recurrence_interval: 1,
    estimated_duration: '',
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '',
        priority_level: task.priority_level,
        category_id: task.category_id || '',
        tags: task.tags?.join(', ') || '',
        is_recurring: task.is_recurring,
        recurrence_type: task.recurrence_type || 'Daily',
        recurrence_interval: task.recurrence_interval || 1,
        estimated_duration: task.estimated_duration?.toString() || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        due_date: '',
        priority_level: 'Medium',
        category_id: '',
        tags: '',
        is_recurring: false,
        recurrence_type: 'Daily',
        recurrence_interval: 1,
        estimated_duration: '',
      });
    }
  }, [task, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check for conflicts if this is a recurring task
      if (formData.is_recurring && formData.due_date) {
        const conflicts = await checkRecurringConflicts();
        if (conflicts.length > 0) {
          toast({
            title: "Scheduling Conflict Detected",
            description: `This recurring task would conflict with existing tasks on ${conflicts.length} day(s). Please choose a different time or resolve conflicts first.`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      const taskData = {
        user_id: user?.id,
        title: formData.title,
        description: formData.description || null,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        priority_level: formData.priority_level,
        category_id: formData.category_id || null,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : null,
        is_recurring: formData.is_recurring,
        recurrence_type: formData.is_recurring ? formData.recurrence_type : null,
        recurrence_interval: formData.is_recurring ? formData.recurrence_interval : null,
        estimated_duration: formData.estimated_duration ? parseInt(formData.estimated_duration) : null,
      };

      let error;
      if (task) {
        const { error: updateError } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', task.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('tasks')
          .insert(taskData);
        error = insertError;
      }

      if (error) throw error;

      // If this is a new recurring task, create additional instances
      if (!task && formData.is_recurring && formData.due_date) {
        await createRecurringInstances(taskData);
      }

      toast({
        title: task ? "Task updated" : formData.is_recurring ? "Recurring task created" : "Task created",
        description: task 
          ? "Your task has been updated successfully." 
          : formData.is_recurring 
            ? "Your recurring task has been created and scheduled across multiple days."
            : "Your new task has been created.",
      });

      onTaskSaved();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkRecurringConflicts = async () => {
    if (!formData.due_date || !formData.is_recurring) return [];

    const baseDate = new Date(formData.due_date);
    const conflicts = [];
    
    // Check next 30 days for conflicts
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(baseDate);
      
      switch (formData.recurrence_type) {
        case 'Daily':
          checkDate.setDate(baseDate.getDate() + i);
          break;
        case 'Weekly':
          checkDate.setDate(baseDate.getDate() + (i * 7));
          break;
        case 'Monthly':
          checkDate.setMonth(baseDate.getMonth() + i);
          break;
        default:
          continue;
      }

      // Check if there's already a task at this time
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('user_id', user?.id)
        .gte('due_date', checkDate.toISOString())
        .lte('due_date', new Date(checkDate.getTime() + 59 * 60 * 1000).toISOString()) // Within same hour
        .neq('status', 'Completed');

      if (existingTasks && existingTasks.length > 0) {
        conflicts.push({
          date: checkDate,
          tasks: existingTasks,
        });
      }
    }

    return conflicts;
  };

  const createRecurringInstances = async (baseTaskData: any) => {
    if (!baseTaskData.due_date) return;

    const baseDate = new Date(baseTaskData.due_date);
    const instancesToCreate = [];
    
    // Create instances for next 90 days
    for (let i = 1; i < 90; i++) {
      const instanceDate = new Date(baseDate);
      
      switch (baseTaskData.recurrence_type) {
        case 'Daily':
          instanceDate.setDate(baseDate.getDate() + i);
          break;
        case 'Weekly':
          if (i % 7 === 0) {
            instanceDate.setDate(baseDate.getDate() + i);
          } else {
            continue;
          }
          break;
        case 'Monthly':
          if (i % 30 === 0) {
            instanceDate.setMonth(baseDate.getMonth() + Math.floor(i / 30));
          } else {
            continue;
          }
          break;
        default:
          continue;
      }

      instancesToCreate.push({
        ...baseTaskData,
        due_date: instanceDate.toISOString(),
        id: undefined, // Let Supabase generate new IDs
      });

      // Limit to prevent too many instances
      if (instancesToCreate.length >= 30) break;
    }

    if (instancesToCreate.length > 0) {
      const { error } = await supabase
        .from('tasks')
        .insert(instancesToCreate);

      if (error) {
        console.error('Error creating recurring instances:', error);
        toast({
          title: "Warning",
          description: "The main task was created, but some recurring instances may not have been generated.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          <DialogDescription>
            {task ? 'Update your task details below.' : 'Fill in the details for your new task.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="datetime-local"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_duration">Duration (minutes)</Label>
              <Input
                id="estimated_duration"
                type="number"
                value={formData.estimated_duration}
                onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
                placeholder="30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority_level} onValueChange={(value: PriorityLevel) => setFormData({ ...formData, priority_level: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="work, urgent, meeting"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="recurring"
              checked={formData.is_recurring}
              onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
            />
            <Label htmlFor="recurring">Recurring Task</Label>
          </div>

          {formData.is_recurring && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recurrence_type">Recurrence</Label>
                <Select value={formData.recurrence_type} onValueChange={(value: RecurrenceType) => setFormData({ ...formData, recurrence_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interval">Interval</Label>
                <Input
                  id="interval"
                  type="number"
                  min="1"
                  value={formData.recurrence_interval}
                  onChange={(e) => setFormData({ ...formData, recurrence_interval: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDialog;
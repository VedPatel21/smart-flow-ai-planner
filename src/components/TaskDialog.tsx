import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Task, Category, PriorityLevel, RecurrenceType } from "@/types/database";
import { Calendar, Clock, Tag, Repeat, AlertCircle } from "lucide-react";

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

  // Helper function to format date for datetime-local input
  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Get local time components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper function to convert local datetime to UTC for storage
  const formatDateForStorage = (localDateString: string): string => {
    if (!localDateString) return '';
    const date = new Date(localDateString);
    return date.toISOString();
  };

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        due_date: task.due_date ? formatDateForInput(task.due_date) : '',
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
      // Validate required fields
      if (!formData.title.trim()) {
        toast({
          title: "Validation Error",
          description: "Task title is required.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

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
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        due_date: formData.due_date ? formatDateForStorage(formData.due_date) : null,
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
      onOpenChange(false);
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

  const getPriorityColor = (priority: PriorityLevel) => {
    switch (priority) {
      case 'Critical': return 'text-red-600';
      case 'High': return 'text-orange-600';
      case 'Medium': return 'text-yellow-600';
      case 'Low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {task ? 'Edit Task' : 'Create New Task'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {task ? 'Update your task details below.' : 'Fill in the details for your new task.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
              className="w-full"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter task description (optional)"
              rows={3}
              className="w-full resize-none"
            />
          </div>

          {/* Date and Duration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="due_date" className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Due Date & Time
              </Label>
              <Input
                id="due_date"
                type="datetime-local"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_duration" className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Duration (minutes)
              </Label>
              <Input
                id="estimated_duration"
                type="number"
                min="1"
                value={formData.estimated_duration}
                onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
                placeholder="30"
                className="w-full"
              />
            </div>
          </div>

          {/* Priority and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority" className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Priority
              </Label>
              <Select value={formData.priority_level} onValueChange={(value: PriorityLevel) => setFormData({ ...formData, priority_level: value })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Low
                    </span>
                  </SelectItem>
                  <SelectItem value="Medium">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="High">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="Critical">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      Critical
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-medium">
                Category
              </Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                <SelectTrigger className="w-full">
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

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags" className="text-sm font-medium flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
            </Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="work, urgent, meeting (comma-separated)"
              className="w-full"
            />
          </div>

          {/* Recurring Task Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Repeat className="w-4 h-4 text-gray-600" />
              <div>
                <Label htmlFor="recurring" className="text-sm font-medium">
                  Recurring Task
                </Label>
                <p className="text-xs text-muted-foreground">
                  Create multiple instances of this task
                </p>
              </div>
            </div>
            <Switch
              id="recurring"
              checked={formData.is_recurring}
              onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
            />
          </div>

          {/* Recurrence Settings */}
          {formData.is_recurring && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
              <h4 className="text-sm font-medium text-blue-900 mb-3">Recurrence Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recurrence_type" className="text-sm font-medium">
                    Frequency
                  </Label>
                  <Select value={formData.recurrence_type} onValueChange={(value: RecurrenceType) => setFormData({ ...formData, recurrence_type: value })}>
                    <SelectTrigger className="w-full">
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
                  <Label htmlFor="interval" className="text-sm font-medium">
                    Interval
                  </Label>
                  <Input
                    id="interval"
                    type="number"
                    min="1"
                    max="30"
                    value={formData.recurrence_interval}
                    onChange={(e) => setFormData({ ...formData, recurrence_interval: parseInt(e.target.value) || 1 })}
                    className="w-full"
                  />
                </div>
              </div>
              <p className="text-xs text-blue-700">
                This will create instances for the next 30 occurrences
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="px-4 py-2"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.title.trim()}
              className="px-4 py-2"
            >
              {loading ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDialog;
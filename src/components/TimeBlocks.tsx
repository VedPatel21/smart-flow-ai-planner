import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/types/database";
import { format, startOfDay, endOfDay, setHours, setMinutes } from "date-fns";
import { Clock, AlertTriangle, Plus } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TimeSlot {
  time: string;
  label: string;
  hour: number;
  task?: Task;
}

interface TimeBlocksProps {
  selectedDate: Date;
  onTaskScheduled?: () => void;
}

const TaskItem = ({ task, isOverlay = false }: { task: Task; isOverlay?: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-2 bg-background border rounded-lg cursor-grab active:cursor-grabbing ${
        isOverlay ? 'rotate-5 shadow-lg' : 'hover:shadow-md transition-shadow'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{task.title}</h4>
          <div className="flex items-center space-x-2 mt-1">
            <Badge className={getPriorityColor(task.priority_level)} variant="outline">
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
      </div>
    </div>
  );
};

const TimeSlotDropZone = ({ slot }: { slot: TimeSlot }) => {
  const {
    setNodeRef,
    isOver,
  } = useSortable({ 
    id: `slot-${slot.time}`,
    data: { type: 'timeslot', slot }
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center space-x-4 p-2 border rounded transition-colors ${
        isOver ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
      }`}
    >
      <div className="w-20 text-sm font-medium">{slot.label}</div>
      <div className={`flex-1 min-h-[50px] border-2 border-dashed rounded-md flex items-center justify-center transition-colors ${
        slot.task ? 'border-primary/50 bg-primary/5' : 
        isOver ? 'border-primary bg-primary/10' : 'border-muted'
      }`}>
        {slot.task ? (
          <TaskItem task={slot.task} />
        ) : (
          <div className="text-muted-foreground text-sm flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Drop task here</span>
          </div>
        )}
      </div>
    </div>
  );
};

const TimeBlocks = ({ selectedDate, onTaskScheduled }: TimeBlocksProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Initialize time slots
  useEffect(() => {
    const slots: TimeSlot[] = [];
    for (let hour = 9; hour <= 17; hour++) {
      slots.push({
        time: `${hour.toString().padStart(2, '0')}:00`,
        label: `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
        hour,
      });
    }
    setTimeSlots(slots);
  }, []);

  useEffect(() => {
    if (user && selectedDate) {
      fetchTasks();
    }
  }, [user, selectedDate]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = endOfDay(selectedDate).toISOString();

      // Fetch all tasks for the day
      const { data: dayTasks, error: dayTasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('user_id', user?.id)
        .gte('due_date', dayStart)
        .lte('due_date', dayEnd)
        .eq('status', 'Pending');

      if (dayTasksError) throw dayTasksError;

      // Separate scheduled and unscheduled tasks
      const scheduled: Task[] = [];
      const unscheduled: Task[] = [];

      dayTasks?.forEach(task => {
        if (task.due_date) {
          const taskDate = new Date(task.due_date);
          const taskHour = taskDate.getHours();
          if (taskHour >= 9 && taskHour <= 17) {
            scheduled.push(task);
          } else {
            unscheduled.push(task);
          }
        } else {
          unscheduled.push(task);
        }
      });

      // Update time slots with scheduled tasks
      setTimeSlots(prevSlots => 
        prevSlots.map(slot => {
          const slotTask = scheduled.find(task => {
            if (task.due_date) {
              const taskDate = new Date(task.due_date);
              return taskDate.getHours() === slot.hour;
            }
            return false;
          });
          return { ...slot, task: slotTask };
        })
      );

      setUnscheduledTasks(unscheduled);
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
    const task = unscheduledTasks.find(t => t.id === event.active.id) ||
                 timeSlots.find(s => s.task?.id === event.active.id)?.task;
    setDraggedTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDraggedTask(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overData = over.data.current;

    if (overData?.type === 'timeslot') {
      const slot = overData.slot as TimeSlot;
      
      // Check for conflicts with recurring tasks
      const conflictingTask = await checkForRecurringConflict(slot.hour, selectedDate);
      if (conflictingTask) {
        toast({
          title: "Scheduling Conflict",
          description: `You already have a recurring task "${conflictingTask.title}" scheduled at ${slot.label}. Please choose a different time slot.`,
          variant: "destructive",
        });
        return;
      }

      // Check if slot already has a task
      if (slot.task) {
        toast({
          title: "Time Slot Occupied",
          description: `This time slot already has "${slot.task.title}" scheduled. Please choose a different time or move the existing task first.`,
          variant: "destructive",
        });
        return;
      }

      await scheduleTask(activeTaskId, slot.hour);
    }
  };

  const checkForRecurringConflict = async (hour: number, date: Date): Promise<Task | null> => {
    try {
      const { data: recurringTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_recurring', true)
        .eq('status', 'Pending');

      if (error) throw error;

      // Check if any recurring task is scheduled for this hour
      for (const task of recurringTasks || []) {
        if (task.due_date) {
          const taskDate = new Date(task.due_date);
          const taskHour = taskDate.getHours();
          
          if (taskHour === hour) {
            // Check if this recurring task applies to the selected date
            const isApplicable = await checkRecurrenceApplies(task, date);
            if (isApplicable) {
              return task;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error checking recurring conflicts:', error);
      return null;
    }
  };

  const checkRecurrenceApplies = async (task: Task, date: Date): Promise<boolean> => {
    if (!task.due_date || !task.recurrence_type) return false;

    const taskDate = new Date(task.due_date);
    const selectedDate = date;

    switch (task.recurrence_type) {
      case 'Daily':
        return selectedDate >= taskDate;
      case 'Weekly':
        return selectedDate >= taskDate && 
               selectedDate.getDay() === taskDate.getDay();
      case 'Monthly':
        return selectedDate >= taskDate && 
               selectedDate.getDate() === taskDate.getDate();
      default:
        return false;
    }
  };

  const scheduleTask = async (taskId: string, hour: number) => {
    try {
      // Create the scheduled time for the task
      const scheduledTime = setMinutes(setHours(selectedDate, hour), 0);

      const { error } = await supabase
        .from('tasks')
        .update({ 
          due_date: scheduledTime.toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: "Task Scheduled",
        description: `Task has been scheduled for ${format(scheduledTime, 'h:mm a')}`,
      });

      fetchTasks();
      onTaskScheduled?.();
    } catch (error: any) {
      toast({
        title: "Error scheduling task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Time Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading time blocks...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Unscheduled Tasks</CardTitle>
            <CardDescription>
              Drag tasks below to schedule them in specific time blocks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unscheduledTasks.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                All tasks are scheduled for this day
              </div>
            ) : (
              <SortableContext 
                items={unscheduledTasks.map(t => t.id)} 
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {unscheduledTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              </SortableContext>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time Blocks</CardTitle>
            <CardDescription>
              Your scheduled time blocks for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SortableContext 
              items={timeSlots.map(s => `slot-${s.time}`)} 
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {timeSlots.map((slot) => (
                  <TimeSlotDropZone
                    key={slot.time}
                    slot={slot}
                  />
                ))}
              </div>
            </SortableContext>
          </CardContent>
        </Card>
      </div>

      <DragOverlay>
        {draggedTask ? <TaskItem task={draggedTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default TimeBlocks;
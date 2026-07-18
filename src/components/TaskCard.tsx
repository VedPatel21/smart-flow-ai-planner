import { Task } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertTriangle, Edit, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";

interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

const TaskCard = ({ task, onComplete, onEdit, onDelete }: TaskCardProps) => {
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

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center space-x-2">
              {getStatusIcon(task.status)}
              <h3 className={`font-medium ${task.status === 'Completed' ? 'line-through text-muted-foreground' : ''}`}>
                {task.title}
              </h3>
              <Badge className={getPriorityColor(task.priority_level)}>
                {task.priority_level}
              </Badge>
              {task.ai_priority_score > 0 && (
                <Badge variant="outline">
                  AI: {task.ai_priority_score.toFixed(1)}
                </Badge>
              )}
            </div>
            
            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}
            
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              {task.due_date && (
                <div className="flex items-center space-x-1">
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(task.due_date), 'MMM d, yyyy')}</span>
                </div>
              )}
              {task.estimated_duration && (
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{task.estimated_duration}m</span>
                </div>
              )}
              {task.category && (
                <Badge variant="outline" style={{ backgroundColor: `${task.category.color}20` }}>
                  {task.category.name}
                </Badge>
              )}
            </div>
            
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            {task.status !== 'Completed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onComplete(task.id)}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(task)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskCard;
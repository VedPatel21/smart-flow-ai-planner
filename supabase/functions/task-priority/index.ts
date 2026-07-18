import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Fetch user's tasks
    const { data: tasks, error } = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'Pending');

    if (error) throw error;

    // AI Priority Algorithm
    const prioritizedTasks = tasks.map(task => {
      let score = 0;

      // Priority level weight (0-4)
      const priorityWeight = {
        'Low': 1,
        'Medium': 2,
        'High': 3,
        'Critical': 4
      }[task.priority_level] || 2;
      score += priorityWeight * 2;

      // Due date urgency (0-3)
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const now = new Date();
        const daysDiff = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff < 1) score += 3; // Due today
        else if (daysDiff < 3) score += 2; // Due in 3 days
        else if (daysDiff < 7) score += 1; // Due in a week
      }

      // Task age (older tasks get slight boost)
      const createdDate = new Date(task.created_at);
      const daysSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated > 7) score += 0.5;

      // Estimated duration preference (shorter tasks get slight boost)
      if (task.estimated_duration && task.estimated_duration <= 30) {
        score += 0.3;
      }

      return {
        ...task,
        ai_priority_score: Math.round(score * 10) / 10
      };
    }).sort((a, b) => b.ai_priority_score - a.ai_priority_score);

    // Update tasks with new AI scores
    for (const task of prioritizedTasks) {
      await supabaseClient
        .from('tasks')
        .update({ ai_priority_score: task.ai_priority_score })
        .eq('id', task.id);
    }

    return new Response(JSON.stringify({
      success: true,
      prioritized_tasks: prioritizedTasks.slice(0, 10)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
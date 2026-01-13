import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Send } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface CommentSectionProps {
  queryId: string;
}

export function CommentSection({ queryId }: CommentSectionProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [queryId]);

  const fetchComments = async () => {
    try {
      const res = await api.get(`/query/${queryId}/comments`);
      setComments(res as Comment[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await api.post(`/query/${queryId}/comments`, { content: newComment });
      setNewComment("");
      fetchComments();
      toast({ title: "Comment added" });
    } catch (e) {
      toast({ title: "Failed to add comment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Comments ({comments.length})</h3>
      
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
        {comments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>}
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{comment.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{comment.user.name}</span>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
              </div>
              <p className="text-sm text-zinc-700 bg-muted/50 p-2 rounded-md">{comment.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <Textarea 
          placeholder="Add a comment..." 
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[60px] resize-none text-sm border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-foreground placeholder:text-muted-foreground focus-visible:ring-zinc-400"
        />
        <Button 
            size="sm" 
            className="h-auto self-end" 
            onClick={handleSubmit} 
            disabled={submitting || !newComment.trim()}
        >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
        </Button>
      </div>
    </div>
  );
}

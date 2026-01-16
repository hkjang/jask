import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

export function FeedbackDialog({ isOpen, onClose, onSubmit }: FeedbackDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({ title: "피드백 내용을 입력해주세요", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    try {
      await onSubmit(reason);
      setReason("");
      onClose();
    } catch (e) {
      // Error handling managed by parent or toast here
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>피드백 제출</DialogTitle>
          <DialogDescription>
            이 쿼리에서 무엇이 잘못되었는지 알려주시면 서비스 개선에 도움이 됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
             placeholder="예: SQL 문법이 잘못되었거나, 필터 조건이 누락되었습니다..."
             value={reason}
             onChange={(e) => setReason(e.target.value)}
             className="min-h-[100px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "제출 중..." : "피드백 제출"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

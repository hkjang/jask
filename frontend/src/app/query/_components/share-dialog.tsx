import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Share2, Users } from "lucide-react";

interface ShareDialogProps {
  queryId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareDialog({ queryId, isOpen, onClose }: ShareDialogProps) {
  const { toast } = useToast();
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  // In a real app, we'd fetch current share status first
  
  const handleShare = async () => {
    setLoading(true);
    try {
      await api.post(`/query/${queryId}/share`, { isPublic });
      toast({ title: "Sharing settings updated" });
      onClose();
    } catch (e) {
       toast({ title: "Failed to update settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
     const url = `${window.location.origin}/query/history/${queryId}`;
     navigator.clipboard.writeText(url);
     toast({ title: "Link copied to clipboard" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share Query</DialogTitle>
          <DialogDescription>
            Share this query and its results with your team.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="link" className="sr-only">
                Link
              </Label>
              <Input
                id="link"
                defaultValue={`${typeof window !== 'undefined' ? window.location.origin : ''}/query/history/${queryId}`}
                readOnly
              />
            </div>
            <Button type="submit" size="sm" className="px-3" onClick={copyLink}>
              <span className="sr-only">Copy</span>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-2 rounded-md border p-4">
            <Users className="h-6 w-6 text-muted-foreground" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none">
                Public Access
              </p>
              <p className="text-sm text-muted-foreground">
                Anyone with the link can view this query.
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleShare} disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

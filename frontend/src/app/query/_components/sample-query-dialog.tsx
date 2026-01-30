import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check } from "lucide-react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface SampleQueryDialogProps {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseQuery?: (sql: string) => void;
}

interface SampleQueryData {
  content: string;
  metadata?: {
    sql?: string;
    message?: string;
  };
}

export function SampleQueryDialog({ id, open, onOpenChange, onUseQuery }: SampleQueryDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: sampleQuery, isLoading, error } = useQuery({
    queryKey: ['sampleQuery', id],
    queryFn: async () => {
      if (!id) return null;
      // Fetching from EmbeddableItem endpoint
      const res = await api.get<SampleQueryData>(`/embedding/items/${id}`);
      return res;
    },
    enabled: !!id && open,
  });

  const handleCopy = () => {
    if (sampleQuery?.metadata?.sql) {
      navigator.clipboard.writeText(sampleQuery.metadata.sql);
      setCopied(true);
      toast({ title: "SQL이 복사되었습니다." });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sql = sampleQuery?.metadata?.sql || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>참조 샘플 쿼리 상세</DialogTitle>
          <DialogDescription>
             유사한 질문에 대한 검증된 SQL 쿼리입니다.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
           <div className="py-8 text-center text-destructive">
             샘플 쿼리 정보를 불러오는데 실패했습니다.
           </div>
        ) : sampleQuery ? (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">질문</h4>
              <div className="p-3 bg-muted rounded-md text-sm">
                {sampleQuery.content}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-muted-foreground">SQL</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 gap-1">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    복사
                  </Button>
                  {onUseQuery && (
                    <Button size="sm" onClick={() => onUseQuery(sql)} className="h-8">
                        이 쿼리 사용
                    </Button>
                  )}
                </div>
              </div>
              <div className="relative rounded-md overflow-hidden bg-[#1e1e1e]">
                <SyntaxHighlighter
                  language="sql"
                  style={vscDarkPlus}
                  customStyle={{ margin: 0, padding: '1rem', fontSize: '13px' }}
                  wrapLines={true}
                  wrapLongLines={true}
                >
                  {sql}
                </SyntaxHighlighter>
              </div>
            </div>
            
            {sampleQuery.metadata?.message && (
                <div>
                     <h4 className="text-sm font-semibold mb-2 text-muted-foreground">설명</h4>
                     <p className="text-sm text-foreground/90 whitespace-pre-wrap">{sampleQuery.metadata.message}</p>
                </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

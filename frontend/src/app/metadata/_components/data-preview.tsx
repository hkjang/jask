
"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, AlertCircle } from "lucide-react";

interface DataPreviewProps {
  tableId: string;
}

export function DataPreview({ tableId }: DataPreviewProps) {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.previewTableData(tableId);
        setData(result);
      } catch (err: any) {
        console.error(err);
        setError("데이터를 불러오는데 실패했습니다.");
        toast({ title: "오류", description: "데이터 미리보기 실패", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    if (tableId) {
      fetchData();
    }
  }, [tableId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/15 text-destructive p-4 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span className="font-semibold">오류:</span> {error}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex justify-center items-center h-full min-h-[200px] text-muted-foreground">
        데이터가 없습니다.
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="w-full h-full p-4 overflow-auto">
      <div className="border rounded-md overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground text-xs uppercase sticky top-0">
                <tr>
                {columns.map((col) => (
                    <th key={col} className="p-3 font-medium whitespace-nowrap border-b">
                    {col}
                    </th>
                ))}
                </tr>
            </thead>
            <tbody className="divide-y">
                {data.map((row, i) => (
                <tr key={i} className="hover:bg-muted/50">
                    {columns.map((col) => (
                    <td key={`${i}-${col}`} className="p-3 whitespace-nowrap border-b last:border-0 max-w-[300px] truncate">
                        {row[col] === null ? (
                            <span className="text-muted-foreground italic">null</span>
                        ) : typeof row[col] === 'object' ? (
                             JSON.stringify(row[col])
                        ) : (
                            String(row[col])
                        )}
                    </td>
                    ))}
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-right">최대 10개 행 미리보기</p>
    </div>
  );
}

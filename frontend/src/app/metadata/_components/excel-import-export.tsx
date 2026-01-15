"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface ExcelImportExportProps {
  dataSourceId: string;
  onImportComplete?: () => void;
}

export function ExcelImportExport({ dataSourceId, onImportComplete }: ExcelImportExportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ updated: number; skipped: number; errors: string[] } | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await api.exportMetadataExcel(dataSourceId);
      toast({ title: "내보내기 완료", description: "메타데이터 Excel 파일이 다운로드되었습니다." });
    } catch (e) {
      toast({ title: "오류", description: "내보내기 실패", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await api.importMetadataExcel(dataSourceId, file);
      setImportResult(result);
      setShowResultDialog(true);
      
      if (result.updated > 0) {
        onImportComplete?.();
      }
    } catch (err: any) {
      toast({ title: "오류", description: err.message || "가져오기 실패", variant: "destructive" });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await api.downloadMetadataTemplate();
      toast({ title: "다운로드 완료", description: "템플릿 파일이 다운로드되었습니다." });
    } catch (e) {
      toast({ title: "오류", description: "템플릿 다운로드 실패", variant: "destructive" });
    }
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold">Excel 메타데이터</h3>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          메타데이터를 Excel로 가져오거나 내보낼 수 있습니다. 템플릿을 다운로드하여 대량 업데이트에 활용하세요.
        </p>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            템플릿 다운로드
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {isExporting ? "내보내는 중..." : "Excel 내보내기"}
          </Button>

          <Button
            size="sm"
            onClick={handleImportClick}
            disabled={isImporting}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Upload className="h-4 w-4" />
            {isImporting ? "가져오는 중..." : "Excel 가져오기"}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </Card>

      {/* Import Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importResult && importResult.errors.length === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              가져오기 결과
            </DialogTitle>
            <DialogDescription>
              Excel 파일에서 메타데이터 가져오기가 완료되었습니다.
            </DialogDescription>
          </DialogHeader>

          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-green-50 rounded-md">
                  <div className="text-green-700 font-medium">업데이트됨</div>
                  <div className="text-2xl font-bold text-green-600">{importResult.updated}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-md">
                  <div className="text-gray-700 font-medium">건너뜀</div>
                  <div className="text-2xl font-bold text-gray-600">{importResult.skipped}</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="p-3 bg-yellow-50 rounded-md">
                  <div className="text-yellow-700 font-medium mb-2">경고 ({importResult.errors.length})</div>
                  <ul className="text-sm text-yellow-600 space-y-1 max-h-32 overflow-auto">
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li className="text-muted-foreground">... 외 {importResult.errors.length - 10}개</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowResultDialog(false)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

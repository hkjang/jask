"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, HelpCircle } from "lucide-react";
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface MetadataQualityScoreProps {
    score: number;
    status: string;
    details?: {
        earnedPoints: number;
        totalPoints: number;
    };
    onValidate?: () => void;
}

export function MetadataQualityScore({ score, status, details, onValidate }: MetadataQualityScoreProps) {
    let colorClass = "bg-red-500";
    if (score >= 90) colorClass = "bg-green-500";
    else if (score >= 50) colorClass = "bg-yellow-500";

    return (
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-card text-card-foreground shadow-sm mb-4">
            <div className="flex flex-col items-center justify-center min-w-[3rem]">
                <div className="relative flex items-center justify-center">
                   <div className={`text-2xl font-bold ${score >= 90 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                     {score}
                   </div>
                   <span className="text-[10px] text-muted-foreground absolute -bottom-3">점수</span>
                </div>
            </div>

            <div className="flex-1 space-y-2">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">메타데이터 상태</span>
                        <StatusBadge status={status} />
                    </div>
                    {onValidate && (
                        <Button variant="ghost" size="sm" onClick={onValidate} className="h-6 text-[10px]">
                            재검증
                        </Button>
                    )}
                </div>
                <Progress value={score} className="h-2" indicatorClassName={colorClass} />
                <div className="text-xs text-muted-foreground flex gap-3">
                   {/* We could show details if available */}
                   <span>상세 설명은 AI 이해에 도움이 됩니다.</span>
                </div>
            </div>
            
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>설명, 컬럼, 관계를 기반으로 한 점수입니다.</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'VERIFIED':
            return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1"/> 검증됨</Badge>;
        case 'PENDING_REVIEW':
            return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><AlertCircle className="w-3 h-3 mr-1"/> 검토</Badge>;
        case 'DRAFT':
        default:
            return <Badge variant="outline" className="text-muted-foreground">초안</Badge>;
    }
}

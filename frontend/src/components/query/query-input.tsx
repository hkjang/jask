'use client';

import { useState } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface QueryInputProps {
  onSubmit: (question: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

const suggestions = [
  '최근 7일간 매출 합계를 알려줘',
  '가장 많이 주문한 고객 Top 10',
  '이번 달 신규 가입자 수',
  '상품별 판매 현황',
];

export function QueryInput({
  onSubmit,
  isLoading = false,
  placeholder = "궁금한 것을 자연어로 질문하세요...",
  className,
}: QueryInputProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = () => {
    if (question.trim() && !isLoading) {
      onSubmit(question.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="relative">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          className="min-h-[120px] resize-none pr-14 text-base"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!question.trim() || isLoading}
          className="absolute bottom-3 right-3"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => setQuestion(suggestion)}
            disabled={isLoading}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors hover:underline"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

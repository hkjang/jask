'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 이미 로그인된 경우 질문 페이지로 이동
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      router.push('/query');
    }
  }, [router]);

  const loginMutation = useMutation({
    mutationFn: () => api.login(email, password),
    onSuccess: (data) => {
      localStorage.setItem('user', JSON.stringify(data.user));
      toast({ title: '로그인 성공' });
      router.push('/');
    },
    onError: (error: Error) => {
      toast({
        title: '로그인 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
              J
            </div>
          </div>
          <CardTitle className="text-2xl">Jask 로그인</CardTitle>
          <CardDescription>
            자연어 기반 SQL 서비스
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">이메일</label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">비밀번호</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* 테스트 계정 정보 */}
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">테스트 계정:</p>
              <p>관리자: admin@jask.io / admin123</p>
              <p>사용자: user@jask.io / user123</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              로그인
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              계정이 없으신가요?{' '}
              <Link href="/register" className="text-primary hover:underline">
                회원가입
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

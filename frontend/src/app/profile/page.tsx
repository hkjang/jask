'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import {
  User,
  Mail,
  Building,
  Save,
  Loader2,
  Sparkles,
  HelpCircle,
  Calendar,
  Lock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  department?: string;
  customInstructions: string;
  createdAt: string;
}

export default function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => api.get<UserProfile>('/auth/profile'),
  });

  // Fetch system settings to check if custom instructions are allowed
  const { data: settings = {} } = useQuery<Record<string, any>>({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/admin/settings', {
          headers: { 'Authorization': `Bearer ${api.getToken()}` },
        });
        if (!response.ok) return {};
        return response.json();
      } catch {
        return {};
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const allowCustomInstructions = settings['allow_custom_instructions'] ?? true; // Default to true if not set

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDepartment(profile.department || '');
      setCustomInstructions(profile.customInstructions || '');
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; department?: string; customInstructions?: string }) =>
      api.put('/auth/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({
        title: '저장 완료',
        description: '프로필이 성공적으로 업데이트되었습니다.',
      });
    },
    onError: () => {
      toast({
        title: '저장 실패',
        description: '프로필 업데이트 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ name, department, customInstructions });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-3xl mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">프로필</h1>
            <p className="text-muted-foreground mt-1">
              개인 정보를 관리하고 AI 맞춤형 지침을 설정하세요
            </p>
          </div>
          <Badge variant={profile?.role === 'ADMIN' ? 'default' : 'secondary'}>
            {profile?.role === 'ADMIN' ? '관리자' : '사용자'}
          </Badge>
        </div>

        {/* Basic Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              기본 정보
            </CardTitle>
            <CardDescription>
              프로필의 기본 정보를 확인하고 수정하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  이메일
                </Label>
                <Input
                  id="email"
                  value={profile?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  이름
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  부서
                </Label>
                <Input
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="부서를 입력하세요"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  가입일
                </Label>
                <Input
                  value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('ko-KR') : ''}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom Instructions Card */}
        {allowCustomInstructions ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    AI 맞춤형 지침
                  </CardTitle>
                  <CardDescription>
                    질문 시 AI가 참고할 개인 맞춤형 지침을 설정하세요
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <HelpCircle className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>맞춤형 지침이란?</DialogTitle>
                      <DialogDescription asChild>
                        <div className="space-y-4 pt-4">
                          <p>
                            맞춤형 지침은 AI가 SQL을 생성하고 설명할 때 참고하는 개인 설정입니다.
                            여기에 입력한 내용이 AI 시스템 프롬프트에 자동으로 추가됩니다.
                          </p>
                          <div className="space-y-2">
                            <p className="font-medium">예시:</p>
                            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                              <li>항상 한국어로 설명해줘</li>
                              <li>SQL 결과를 표 형식으로 요약해줘</li>
                              <li>복잡한 JOIN 쿼리는 단계별로 설명해줘</li>
                              <li>성능 최적화 팁도 함께 알려줘</li>
                              <li>주석을 SQL에 포함해줘</li>
                            </ul>
                          </div>
                        </div>
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="AI가 참고할 맞춤형 지침을 입력하세요...&#10;&#10;예: 항상 한국어로 설명해주고, SQL 결과를 요약해줘"
                className="min-h-[150px] resize-y"
              />
              <p className="text-xs text-muted-foreground">
                💡 입력한 지침은 질문할 때마다 AI 시스템 프롬프트에 자동으로 포함됩니다.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-muted bg-muted/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-muted-foreground">AI 맞춤형 지침</CardTitle>
              </div>
              <CardDescription>
                이 기능은 현재 시스템 설정에 의해 비활성화되어 있습니다.
                관리자에게 문의하세요.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Separator />

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            저장
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}

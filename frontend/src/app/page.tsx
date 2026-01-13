'use client';

import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Database, History, Sparkles, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <MainLayout>
      <div className="container max-w-5xl py-12">
        {/* Hero */}
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            AI 기반 자연어 SQL 서비스
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            자연어로 데이터를 질문하세요
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            복잡한 SQL 없이 자연어로 질문하면 AI가 SQL을 생성하고, 
            검증하고, 실행하고, 결과를 설명해 드립니다.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/query">
              <Button size="lg" className="gap-2">
                질문 시작하기
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/datasources">
              <Button size="lg" variant="outline">
                데이터소스 연결
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <MessageSquare className="h-6 w-6" />
              </div>
              <CardTitle>자연어 질문</CardTitle>
              <CardDescription>
                SQL을 몰라도 됩니다. 자연어로 원하는 데이터를 질문하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• 한국어 지원</li>
                <li>• 의도 자동 분석</li>
                <li>• 질문 제안</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10 text-green-500 mb-2">
                <Database className="h-6 w-6" />
              </div>
              <CardTitle>안전한 실행</CardTitle>
              <CardDescription>
                SQL 검증 및 보안 체크로 안전하게 쿼리를 실행합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• SELECT 전용</li>
                <li>• 위험 명령 차단</li>
                <li>• 실행 비용 분석</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 mb-2">
                <History className="h-6 w-6" />
              </div>
              <CardTitle>결과 이해</CardTitle>
              <CardDescription>
                AI가 SQL과 결과를 쉽게 설명해 드립니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• SQL 설명</li>
                <li>• 결과 요약</li>
                <li>• 히스토리 저장</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Quick Start */}
        <div className="mt-12 rounded-xl border bg-card p-8">
          <h2 className="text-2xl font-bold mb-4">빠른 시작</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                1
              </div>
              <div>
                <p className="font-medium">데이터소스 연결</p>
                <p className="text-sm text-muted-foreground">DB 연결 정보 입력</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                2
              </div>
              <div>
                <p className="font-medium">메타데이터 동기화</p>
                <p className="text-sm text-muted-foreground">스키마 자동 수집</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                3
              </div>
              <div>
                <p className="font-medium">자연어 질문</p>
                <p className="text-sm text-muted-foreground">데이터 질문</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                4
              </div>
              <div>
                <p className="font-medium">결과 확인</p>
                <p className="text-sm text-muted-foreground">데이터 분석</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

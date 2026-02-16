# Jask Code Suggestion - Bitbucket Server Plugin

AI 기반 코드 제안 플러그인으로, Pull Request에서 자동으로 코드 리뷰 및 개선 제안을 제공합니다.

## 주요 기능

- **자동 코드 분석**: PR 생성/업데이트 시 자동으로 AI 코드 리뷰 실행
- **인라인 코드 제안**: Diff 뷰에서 라인별 개선 제안 표시
- **머지 체크**: 심각한 이슈 미해결 시 머지 차단
- **다중 LLM 지원**: Ollama, vLLM, OpenAI 호환 API 지원
- **카테고리별 분석**: 보안, 성능, 버그 위험, 코드 스타일, 모범 사례 등
- **관리자 설정**: 전역 설정 페이지에서 LLM 연결, 분석 옵션, 파일 필터 관리

## 분석 카테고리

| 카테고리 | 설명 |
|----------|------|
| SECURITY | SQL 인젝션, XSS, 하드코딩된 비밀번호 등 |
| PERFORMANCE | N+1 쿼리, 메모리 누수, 비효율적 알고리즘 |
| BUG_RISK | NPE 가능성, 경쟁 조건, 리소스 누수 |
| CODE_STYLE | 네이밍 컨벤션, 포맷팅, 일관성 |
| BEST_PRACTICE | SOLID 원칙, 디자인 패턴 |
| COMPLEXITY | 순환 복잡도, 중첩 깊이 |
| ERROR_HANDLING | 누락된 예외 처리, 에러 무시 |

## 빌드 및 설치

### 사전 요구사항

- JDK 11+
- Maven 3.6+
- Atlassian Plugin SDK

### 빌드

```bash
cd bitbucket-code-suggestion-addon

# 플러그인 빌드
mvn clean package

# 로컬 Bitbucket에서 테스트
mvn bitbucket:run

# 테스트 실행
mvn test
```

### 설치

1. `target/code-suggestion-addon-1.0.0.jar` 파일을 생성합니다
2. Bitbucket Server 관리자 > Manage apps > Upload app에서 JAR를 업로드합니다
3. 플러그인 활성화 후 "AI 코드 제안 설정" 메뉴에서 LLM을 설정합니다

## 설정

### LLM 설정

| 항목 | 기본값 | 설명 |
|------|--------|------|
| API 엔드포인트 | `http://localhost:11434/api/chat` | LLM API URL |
| 모델명 | `codellama:13b` | 사용할 모델 |
| Temperature | `0.1` | 낮을수록 일관성 있는 결과 |
| 최대 토큰 | `4096` | 응답 최대 길이 |

### 분석 설정

| 항목 | 기본값 | 설명 |
|------|--------|------|
| 자동 분석 | `true` | PR 이벤트 시 자동 실행 |
| 머지 체크 | `false` | CRITICAL 이슈 시 머지 차단 |
| 최소 확신도 | `0.7` | 이 값 미만 제안 필터링 |

## REST API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/rest/code-suggestion/1.0/analyze` | 코드 분석 실행 |
| GET | `/rest/code-suggestion/1.0/suggestions/{repoId}/{prId}` | 제안 목록 조회 |
| GET | `/rest/code-suggestion/1.0/suggestions/{repoId}/{prId}/file?path=...` | 파일별 제안 조회 |
| PUT | `/rest/code-suggestion/1.0/suggestions/{id}/status` | 제안 상태 변경 |
| DELETE | `/rest/code-suggestion/1.0/suggestions/{repoId}/{prId}` | 제안 삭제 |
| GET | `/rest/code-suggestion/1.0/stats/{repoId}/{prId}` | 통계 조회 |
| GET | `/rest/code-suggestion/1.0/admin/settings` | 설정 조회 |
| PUT | `/rest/code-suggestion/1.0/admin/settings` | 설정 저장 |
| POST | `/rest/code-suggestion/1.0/admin/test-connection` | LLM 연결 테스트 |

## 프로젝트 구조

```
bitbucket-code-suggestion-addon/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/com/jask/bitbucket/
│   │   │   ├── ao/                    # Active Objects (DB 엔티티)
│   │   │   ├── config/                # 플러그인 설정 서비스
│   │   │   ├── hook/                  # PR 이벤트 리스너, 머지 체크
│   │   │   ├── model/                 # 데이터 모델
│   │   │   ├── rest/                  # REST API 엔드포인트
│   │   │   ├── service/               # 핵심 비즈니스 로직
│   │   │   └── servlet/               # 관리자 설정 서블릿
│   │   └── resources/
│   │       ├── atlassian-plugin.xml   # 플러그인 디스크립터
│   │       ├── css/                   # 스타일시트
│   │       ├── js/                    # JavaScript
│   │       └── templates/             # Soy 템플릿
│   └── test/
│       └── java/com/jask/bitbucket/   # 단위 테스트
```

## 지원 언어

Java, JavaScript, TypeScript, Python, Go, Kotlin, Scala, Ruby, PHP, C#, C++, C, Rust, Swift

## 라이선스

Proprietary - Jask

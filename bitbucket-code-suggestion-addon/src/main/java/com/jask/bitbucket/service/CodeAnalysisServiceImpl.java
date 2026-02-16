package com.jask.bitbucket.service;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import com.google.gson.JsonObject;
import com.jask.bitbucket.config.PluginSettingsService;
import com.jask.bitbucket.model.*;
import com.atlassian.plugin.spring.scanner.annotation.export.ExportAsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.inject.Named;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Core code analysis service that uses LLM to generate code suggestions.
 */
@ExportAsService({CodeAnalysisService.class})
@Named("codeAnalysisService")
public class CodeAnalysisServiceImpl implements CodeAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(CodeAnalysisServiceImpl.class);

    private static final String SYSTEM_PROMPT = """
            당신은 전문 코드 리뷰어입니다. 주어진 코드 diff를 분석하고 개선 사항을 JSON 배열로 제안합니다.

            각 제안은 다음 JSON 형식이어야 합니다:
            {
              "filePath": "파일 경로",
              "startLine": 시작 줄 번호,
              "endLine": 끝 줄 번호,
              "originalCode": "원본 코드",
              "suggestedCode": "개선된 코드",
              "explanation": "개선 이유 설명 (한국어)",
              "severity": "CRITICAL|WARNING|INFO|HINT",
              "category": "SECURITY|PERFORMANCE|BUG_RISK|CODE_STYLE|BEST_PRACTICE|DUPLICATION|COMPLEXITY|ERROR_HANDLING",
              "confidence": 0.0~1.0
            }

            분석 기준:
            1. **보안(SECURITY)**: SQL 인젝션, XSS, 경로 탐색, 하드코딩된 비밀번호 등
            2. **성능(PERFORMANCE)**: N+1 쿼리, 불필요한 반복, 메모리 누수, 비효율적 알고리즘
            3. **버그 위험(BUG_RISK)**: NPE 가능성, 경쟁 조건, 리소스 누수, 잘못된 로직
            4. **코드 스타일(CODE_STYLE)**: 네이밍 컨벤션, 포맷팅, 일관성
            5. **모범 사례(BEST_PRACTICE)**: 디자인 패턴, SOLID 원칙, 에러 처리
            6. **중복(DUPLICATION)**: 반복된 코드, 추출 가능한 메서드
            7. **복잡도(COMPLEXITY)**: 순환 복잡도, 중첩 깊이, 메서드 길이
            8. **에러 처리(ERROR_HANDLING)**: 누락된 예외 처리, 포괄적 catch, 에러 무시

            규칙:
            - 변경된 코드만 분석 (diff에 포함된 라인만)
            - 확신이 없으면 confidence를 낮게 설정
            - severity가 높을수록 confidence도 높아야 함
            - 코드 개선 제안 시 반드시 실행 가능한 코드를 제공
            - 응답은 반드시 JSON 배열만 반환 (추가 텍스트 없음)
            """;

    private final LlmClientService llmClient;
    private final PluginSettingsService settingsService;
    private final Gson gson;

    @Inject
    public CodeAnalysisServiceImpl(LlmClientService llmClient, PluginSettingsService settingsService) {
        this.llmClient = llmClient;
        this.settingsService = settingsService;
        this.gson = new Gson();
    }

    @Override
    public AnalysisResponse analyze(AnalysisRequest request) {
        long startTime = System.currentTimeMillis();
        AnalysisResponse response = new AnalysisResponse();
        response.setPullRequestId(request.getPullRequestId());
        response.setRepositoryId(request.getRepositoryId());

        try {
            List<AnalysisRequest.FileDiff> fileDiffs = filterFiles(request.getFileDiffs());
            List<CodeSuggestion> allSuggestions = new ArrayList<>();

            for (AnalysisRequest.FileDiff fileDiff : fileDiffs) {
                try {
                    String language = detectLanguage(fileDiff.getFilePath());
                    AnalysisResponse fileResponse = analyzeFile(fileDiff, language);
                    if (fileResponse.getSuggestions() != null) {
                        allSuggestions.addAll(fileResponse.getSuggestions());
                    }
                } catch (Exception e) {
                    log.warn("파일 분석 실패: {} - {}", fileDiff.getFilePath(), e.getMessage());
                }
            }

            double minConfidence = settingsService.getMinConfidenceThreshold();
            List<CodeSuggestion> filteredSuggestions = allSuggestions.stream()
                    .filter(s -> s.getConfidence() >= minConfidence)
                    .sorted(Comparator.comparing(CodeSuggestion::getSeverity)
                            .thenComparing(Comparator.comparingDouble(CodeSuggestion::getConfidence).reversed()))
                    .collect(Collectors.toList());

            response.setSuggestions(filteredSuggestions);
            response.setSummary(buildSummary(fileDiffs.size(), filteredSuggestions));
            response.setSuccess(true);

        } catch (Exception e) {
            log.error("코드 분석 실패: {}", e.getMessage(), e);
            response.setSuccess(false);
            response.setError("코드 분석 중 오류가 발생했습니다: " + e.getMessage());
        }

        response.setAnalysisTimeMs(System.currentTimeMillis() - startTime);
        return response;
    }

    @Override
    public AnalysisResponse analyzeFile(AnalysisRequest.FileDiff fileDiff, String language) {
        AnalysisResponse response = new AnalysisResponse();

        String userPrompt = buildUserPrompt(fileDiff, language);

        LlmRequest llmRequest = new LlmRequest();
        llmRequest.setMessages(Arrays.asList(
                new LlmRequest.Message("system", SYSTEM_PROMPT),
                new LlmRequest.Message("user", userPrompt)
        ));

        String llmResponse = llmClient.chat(llmRequest);
        List<CodeSuggestion> suggestions = parseSuggestions(llmResponse, fileDiff.getFilePath());

        response.setSuggestions(suggestions);
        response.setSuccess(true);
        return response;
    }

    private List<AnalysisRequest.FileDiff> filterFiles(List<AnalysisRequest.FileDiff> fileDiffs) {
        if (fileDiffs == null) return Collections.emptyList();

        String excludedPatterns = settingsService.getExcludedFilePatterns();
        Set<String> excludedSet = new HashSet<>(Arrays.asList(excludedPatterns.split(",")));
        int maxFiles = settingsService.getMaxFilesPerAnalysis();

        return fileDiffs.stream()
                .filter(f -> !isExcluded(f.getFilePath(), excludedSet))
                .filter(f -> isSupportedLanguage(f.getFilePath()))
                .limit(maxFiles)
                .collect(Collectors.toList());
    }

    private boolean isExcluded(String filePath, Set<String> patterns) {
        for (String pattern : patterns) {
            String trimmed = pattern.trim();
            if (trimmed.startsWith("*.")) {
                String ext = trimmed.substring(1);
                if (filePath.endsWith(ext)) return true;
            } else if (filePath.endsWith(trimmed) || filePath.contains(trimmed)) {
                return true;
            }
        }
        return false;
    }

    private boolean isSupportedLanguage(String filePath) {
        String supported = settingsService.getSupportedLanguages();
        String language = detectLanguage(filePath);
        return supported.toLowerCase().contains(language.toLowerCase());
    }

    private String detectLanguage(String filePath) {
        if (filePath == null) return "unknown";
        String lower = filePath.toLowerCase();

        if (lower.endsWith(".java")) return "java";
        if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
        if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
        if (lower.endsWith(".py")) return "python";
        if (lower.endsWith(".go")) return "go";
        if (lower.endsWith(".kt") || lower.endsWith(".kts")) return "kotlin";
        if (lower.endsWith(".scala") || lower.endsWith(".sc")) return "scala";
        if (lower.endsWith(".rb")) return "ruby";
        if (lower.endsWith(".php")) return "php";
        if (lower.endsWith(".cs")) return "csharp";
        if (lower.endsWith(".cpp") || lower.endsWith(".cc") || lower.endsWith(".cxx")) return "cpp";
        if (lower.endsWith(".c") || lower.endsWith(".h")) return "c";
        if (lower.endsWith(".rs")) return "rust";
        if (lower.endsWith(".swift")) return "swift";
        if (lower.endsWith(".sql")) return "sql";
        if (lower.endsWith(".sh") || lower.endsWith(".bash")) return "shell";
        if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml";
        if (lower.endsWith(".xml")) return "xml";
        if (lower.endsWith(".json")) return "json";

        return "unknown";
    }

    private String buildUserPrompt(AnalysisRequest.FileDiff fileDiff, String language) {
        StringBuilder sb = new StringBuilder();
        sb.append("## 분석 대상 파일\n\n");
        sb.append("- **파일 경로**: ").append(fileDiff.getFilePath()).append("\n");
        sb.append("- **언어**: ").append(language).append("\n\n");

        sb.append("## Diff 내용\n\n```diff\n");
        sb.append(fileDiff.getDiff());
        sb.append("\n```\n\n");

        if (fileDiff.getFullContent() != null && !fileDiff.getFullContent().isEmpty()) {
            sb.append("## 전체 파일 컨텍스트 (참고용)\n\n```").append(language).append("\n");
            sb.append(fileDiff.getFullContent());
            sb.append("\n```\n\n");
        }

        sb.append("위 코드 변경사항을 분석하고 개선 제안을 JSON 배열로 반환해주세요.");

        return sb.toString();
    }

    private List<CodeSuggestion> parseSuggestions(String llmResponse, String filePath) {
        List<CodeSuggestion> suggestions = new ArrayList<>();

        try {
            // Try to extract JSON array from the response
            String jsonContent = extractJsonArray(llmResponse);
            JsonArray jsonArray = JsonParser.parseString(jsonContent).getAsJsonArray();

            for (JsonElement element : jsonArray) {
                try {
                    JsonObject obj = element.getAsJsonObject();
                    CodeSuggestion suggestion = new CodeSuggestion();

                    suggestion.setFilePath(obj.has("filePath") ?
                            obj.get("filePath").getAsString() : filePath);
                    suggestion.setStartLine(obj.has("startLine") ?
                            obj.get("startLine").getAsInt() : 0);
                    suggestion.setEndLine(obj.has("endLine") ?
                            obj.get("endLine").getAsInt() : 0);
                    suggestion.setOriginalCode(obj.has("originalCode") ?
                            obj.get("originalCode").getAsString() : "");
                    suggestion.setSuggestedCode(obj.has("suggestedCode") ?
                            obj.get("suggestedCode").getAsString() : "");
                    suggestion.setExplanation(obj.has("explanation") ?
                            obj.get("explanation").getAsString() : "");

                    String severity = obj.has("severity") ?
                            obj.get("severity").getAsString().toUpperCase() : "INFO";
                    suggestion.setSeverity(parseSeverity(severity));

                    String category = obj.has("category") ?
                            obj.get("category").getAsString().toUpperCase() : "BEST_PRACTICE";
                    suggestion.setCategory(parseCategory(category));

                    suggestion.setConfidence(obj.has("confidence") ?
                            obj.get("confidence").getAsDouble() : 0.5);
                    suggestion.setStatus("PENDING");

                    suggestions.add(suggestion);
                } catch (Exception e) {
                    log.warn("제안 항목 파싱 실패: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("LLM 응답 JSON 파싱 실패: {}", e.getMessage());
        }

        return suggestions;
    }

    private String extractJsonArray(String text) {
        int start = text.indexOf('[');
        int end = text.lastIndexOf(']');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return "[]";
    }

    private CodeSuggestion.Severity parseSeverity(String value) {
        try {
            return CodeSuggestion.Severity.valueOf(value);
        } catch (IllegalArgumentException e) {
            return CodeSuggestion.Severity.INFO;
        }
    }

    private CodeSuggestion.Category parseCategory(String value) {
        try {
            return CodeSuggestion.Category.valueOf(value);
        } catch (IllegalArgumentException e) {
            return CodeSuggestion.Category.BEST_PRACTICE;
        }
    }

    private AnalysisResponse.AnalysisSummary buildSummary(int totalFiles, List<CodeSuggestion> suggestions) {
        AnalysisResponse.AnalysisSummary summary = new AnalysisResponse.AnalysisSummary();
        summary.setTotalFiles(totalFiles);
        summary.setTotalSuggestions(suggestions.size());

        int critical = 0, warning = 0, info = 0, hint = 0;
        Map<String, Integer> categoryMap = new HashMap<>();

        for (CodeSuggestion s : suggestions) {
            switch (s.getSeverity()) {
                case CRITICAL: critical++; break;
                case WARNING: warning++; break;
                case INFO: info++; break;
                case HINT: hint++; break;
            }
            String cat = s.getCategory() != null ? s.getCategory().name() : "OTHER";
            categoryMap.merge(cat, 1, Integer::sum);
        }

        summary.setCriticalCount(critical);
        summary.setWarningCount(warning);
        summary.setInfoCount(info);
        summary.setHintCount(hint);
        summary.setCategoryBreakdown(categoryMap);

        // Calculate quality score (100 = perfect, deductions per issue)
        double score = 100.0;
        score -= critical * 20;
        score -= warning * 5;
        score -= info * 1;
        summary.setOverallScore(Math.max(0, Math.min(100, score)));

        return summary;
    }
}

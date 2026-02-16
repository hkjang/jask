package com.jask.bitbucket.service;

import com.jask.bitbucket.config.PluginSettingsService;
import com.jask.bitbucket.model.AnalysisRequest;
import com.jask.bitbucket.model.AnalysisResponse;
import com.jask.bitbucket.model.CodeSuggestion;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Arrays;
import java.util.List;

import static org.junit.Assert.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

public class CodeAnalysisServiceTest {

    @Mock
    private LlmClientService llmClientService;

    @Mock
    private PluginSettingsService settingsService;

    private CodeAnalysisServiceImpl codeAnalysisService;

    @Before
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        codeAnalysisService = new CodeAnalysisServiceImpl(llmClientService, settingsService);

        // Default settings
        when(settingsService.getMinConfidenceThreshold()).thenReturn(0.5);
        when(settingsService.getExcludedFilePatterns()).thenReturn("*.min.js,*.map");
        when(settingsService.getSupportedLanguages()).thenReturn("java,javascript,typescript,python");
        when(settingsService.getMaxFilesPerAnalysis()).thenReturn(50);
        when(settingsService.getMaxFileSizeKb()).thenReturn(500);
    }

    @Test
    public void testAnalyze_successfulAnalysis() {
        String llmResponse = """
                [
                  {
                    "filePath": "src/Main.java",
                    "startLine": 10,
                    "endLine": 15,
                    "originalCode": "String password = \\"admin\\";",
                    "suggestedCode": "String password = System.getenv(\\"DB_PASSWORD\\");",
                    "explanation": "하드코딩된 비밀번호는 보안 취약점입니다.",
                    "severity": "CRITICAL",
                    "category": "SECURITY",
                    "confidence": 0.95
                  }
                ]
                """;

        when(llmClientService.chat(any())).thenReturn(llmResponse);

        AnalysisRequest request = new AnalysisRequest();
        request.setPullRequestId(1);
        request.setRepositoryId(100);

        AnalysisRequest.FileDiff fileDiff = new AnalysisRequest.FileDiff();
        fileDiff.setFilePath("src/Main.java");
        fileDiff.setDiff("+String password = \"admin\";");
        request.setFileDiffs(Arrays.asList(fileDiff));

        AnalysisResponse response = codeAnalysisService.analyze(request);

        assertTrue(response.isSuccess());
        assertNotNull(response.getSuggestions());
        assertEquals(1, response.getSuggestions().size());

        CodeSuggestion suggestion = response.getSuggestions().get(0);
        assertEquals(CodeSuggestion.Severity.CRITICAL, suggestion.getSeverity());
        assertEquals(CodeSuggestion.Category.SECURITY, suggestion.getCategory());
        assertEquals(0.95, suggestion.getConfidence(), 0.01);
    }

    @Test
    public void testAnalyze_emptyFileDiffs() {
        AnalysisRequest request = new AnalysisRequest();
        request.setPullRequestId(1);
        request.setRepositoryId(100);
        request.setFileDiffs(Arrays.asList());

        AnalysisResponse response = codeAnalysisService.analyze(request);

        assertTrue(response.isSuccess());
        assertNotNull(response.getSuggestions());
        assertTrue(response.getSuggestions().isEmpty());
    }

    @Test
    public void testAnalyze_excludedFilesAreFiltered() {
        AnalysisRequest request = new AnalysisRequest();
        request.setPullRequestId(1);
        request.setRepositoryId(100);

        AnalysisRequest.FileDiff minJs = new AnalysisRequest.FileDiff();
        minJs.setFilePath("dist/app.min.js");
        minJs.setDiff("+code");

        AnalysisRequest.FileDiff mapFile = new AnalysisRequest.FileDiff();
        mapFile.setFilePath("dist/app.js.map");
        mapFile.setDiff("+code");

        request.setFileDiffs(Arrays.asList(minJs, mapFile));

        AnalysisResponse response = codeAnalysisService.analyze(request);

        assertTrue(response.isSuccess());
        // All files should be excluded
        assertNotNull(response.getSuggestions());
        assertTrue(response.getSuggestions().isEmpty());
    }

    @Test
    public void testAnalyze_lowConfidenceSuggestionsFiltered() {
        when(settingsService.getMinConfidenceThreshold()).thenReturn(0.8);

        String llmResponse = """
                [
                  {
                    "filePath": "src/Main.java",
                    "startLine": 1,
                    "endLine": 1,
                    "explanation": "Low confidence suggestion",
                    "severity": "HINT",
                    "category": "CODE_STYLE",
                    "confidence": 0.5
                  }
                ]
                """;

        when(llmClientService.chat(any())).thenReturn(llmResponse);

        AnalysisRequest request = new AnalysisRequest();
        request.setPullRequestId(1);
        request.setRepositoryId(100);

        AnalysisRequest.FileDiff fileDiff = new AnalysisRequest.FileDiff();
        fileDiff.setFilePath("src/Main.java");
        fileDiff.setDiff("+int x = 1;");
        request.setFileDiffs(Arrays.asList(fileDiff));

        AnalysisResponse response = codeAnalysisService.analyze(request);

        assertTrue(response.isSuccess());
        // Suggestion with confidence 0.5 should be filtered (threshold = 0.8)
        assertTrue(response.getSuggestions().isEmpty());
    }

    @Test
    public void testAnalyze_llmError_returnsFailure() {
        when(llmClientService.chat(any())).thenThrow(
                new LlmClientService.LlmException("서버 응답 없음"));

        AnalysisRequest request = new AnalysisRequest();
        request.setPullRequestId(1);
        request.setRepositoryId(100);

        AnalysisRequest.FileDiff fileDiff = new AnalysisRequest.FileDiff();
        fileDiff.setFilePath("src/Main.java");
        fileDiff.setDiff("+code");
        request.setFileDiffs(Arrays.asList(fileDiff));

        AnalysisResponse response = codeAnalysisService.analyze(request);

        // Should still return success=true because we catch per-file errors
        assertTrue(response.isSuccess());
        // No suggestions due to error
        assertTrue(response.getSuggestions().isEmpty());
    }

    @Test
    public void testAnalyze_summaryCalculation() {
        String llmResponse = """
                [
                  {"filePath":"a.java","startLine":1,"endLine":1,"explanation":"Critical","severity":"CRITICAL","category":"SECURITY","confidence":0.9},
                  {"filePath":"a.java","startLine":5,"endLine":5,"explanation":"Warning","severity":"WARNING","category":"PERFORMANCE","confidence":0.8},
                  {"filePath":"a.java","startLine":10,"endLine":10,"explanation":"Info","severity":"INFO","category":"CODE_STYLE","confidence":0.7}
                ]
                """;

        when(llmClientService.chat(any())).thenReturn(llmResponse);

        AnalysisRequest request = new AnalysisRequest();
        request.setPullRequestId(1);
        request.setRepositoryId(100);

        AnalysisRequest.FileDiff fileDiff = new AnalysisRequest.FileDiff();
        fileDiff.setFilePath("src/Main.java");
        fileDiff.setDiff("+code");
        request.setFileDiffs(Arrays.asList(fileDiff));

        AnalysisResponse response = codeAnalysisService.analyze(request);

        assertNotNull(response.getSummary());
        assertEquals(3, response.getSummary().getTotalSuggestions());
        assertEquals(1, response.getSummary().getCriticalCount());
        assertEquals(1, response.getSummary().getWarningCount());
        assertEquals(1, response.getSummary().getInfoCount());

        // Score: 100 - 20(critical) - 5(warning) - 1(info) = 74
        assertEquals(74.0, response.getSummary().getOverallScore(), 0.01);
    }
}

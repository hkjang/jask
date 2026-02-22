package com.jask.bitbucket.rest;

import com.jask.bitbucket.model.AnalysisResponse;
import com.jask.bitbucket.model.CodeSuggestion;
import com.jask.bitbucket.service.CodeAnalysisService;
import com.jask.bitbucket.service.SuggestionService;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import javax.ws.rs.core.Response;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.Assert.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class CodeSuggestionResourceTest {

    @Mock
    private CodeAnalysisService codeAnalysisService;

    @Mock
    private SuggestionService suggestionService;

    private CodeSuggestionResource resource;

    @Before
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        resource = new CodeSuggestionResource(codeAnalysisService, suggestionService);
    }

    @Test
    public void testGetSuggestions_success() {
        CodeSuggestion suggestion = new CodeSuggestion();
        suggestion.setId(1);
        suggestion.setSeverity(CodeSuggestion.Severity.WARNING);
        suggestion.setExplanation("Test suggestion");

        when(suggestionService.getSuggestions(1L, 100))
                .thenReturn(Arrays.asList(suggestion));
        when(suggestionService.getStats(1L, 100))
                .thenReturn(new SuggestionService.SuggestionStats());

        Response response = resource.getSuggestions(100, 1L);

        assertEquals(200, response.getStatus());
        assertNotNull(response.getEntity());
    }

    @Test
    public void testGetSuggestions_empty() {
        when(suggestionService.getSuggestions(1L, 100))
                .thenReturn(Collections.emptyList());
        when(suggestionService.getStats(1L, 100))
                .thenReturn(new SuggestionService.SuggestionStats());

        Response response = resource.getSuggestions(100, 1L);

        assertEquals(200, response.getStatus());
    }

    @Test
    public void testUpdateSuggestionStatus_accept() {
        CodeSuggestion updated = new CodeSuggestion();
        updated.setId(1);
        updated.setStatus("ACCEPTED");

        when(suggestionService.updateSuggestionStatus(1L, "ACCEPTED", "admin"))
                .thenReturn(updated);

        String requestBody = "{\"status\": \"ACCEPTED\", \"resolvedBy\": \"admin\"}";
        Response response = resource.updateSuggestionStatus(1L, requestBody);

        assertEquals(200, response.getStatus());
        verify(suggestionService).updateSuggestionStatus(1L, "ACCEPTED", "admin");
    }

    @Test
    public void testUpdateSuggestionStatus_invalidStatus() {
        String requestBody = "{\"status\": \"INVALID\"}";
        Response response = resource.updateSuggestionStatus(1L, requestBody);

        assertEquals(400, response.getStatus());
    }

    @Test
    public void testUpdateSuggestionStatus_missingStatus() {
        String requestBody = "{}";
        Response response = resource.updateSuggestionStatus(1L, requestBody);

        assertEquals(400, response.getStatus());
    }

    @Test
    public void testDeleteSuggestions() {
        doNothing().when(suggestionService).deleteSuggestions(1L, 100);

        Response response = resource.deleteSuggestions(100, 1L);

        assertEquals(200, response.getStatus());
        verify(suggestionService).deleteSuggestions(1L, 100);
    }

    @Test
    public void testGetStats() {
        SuggestionService.SuggestionStats stats = new SuggestionService.SuggestionStats();
        stats.setTotal(5);
        stats.setCritical(1);
        stats.setWarning(2);

        when(suggestionService.getStats(1L, 100)).thenReturn(stats);

        Response response = resource.getStats(100, 1L);

        assertEquals(200, response.getStatus());
    }

    @Test
    public void testAnalyzeCode_missingParams() {
        String requestBody = "{\"pullRequestId\": 0}";
        Response response = resource.analyzeCode(requestBody);

        assertEquals(400, response.getStatus());
    }

    @Test
    public void testGetSuggestionsForFile_missingPath() {
        Response response = resource.getSuggestionsForFile(100, 1L, null);

        assertEquals(400, response.getStatus());
    }

    @Test
    public void testGetSuggestionsForFile_success() {
        when(suggestionService.getSuggestionsForFile(1L, 100, "src/Main.java"))
                .thenReturn(Collections.emptyList());

        Response response = resource.getSuggestionsForFile(100, 1L, "src/Main.java");

        assertEquals(200, response.getStatus());
    }
}

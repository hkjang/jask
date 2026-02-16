package com.jask.bitbucket.rest;

import com.google.gson.Gson;
import com.jask.bitbucket.config.PluginSettingsService;
import com.jask.bitbucket.service.LlmClientService;

import javax.inject.Inject;
import javax.inject.Named;
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Map;

/**
 * REST resource for admin configuration management.
 *
 * Base path: /rest/code-suggestion/1.0/admin
 */
@Named("adminConfigResource")
@Path("/admin")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminConfigResource {

    private final PluginSettingsService settingsService;
    private final LlmClientService llmClientService;
    private final Gson gson;

    @Inject
    public AdminConfigResource(PluginSettingsService settingsService,
                                LlmClientService llmClientService) {
        this.settingsService = settingsService;
        this.llmClientService = llmClientService;
        this.gson = new Gson();
    }

    /**
     * Get current plugin settings.
     *
     * GET /rest/code-suggestion/1.0/admin/settings
     */
    @GET
    @Path("/settings")
    public Response getSettings() {
        Map<String, Object> settings = new HashMap<>();

        // LLM settings
        settings.put("llmEndpoint", settingsService.getLlmEndpoint());
        settings.put("llmModel", settingsService.getLlmModel());
        settings.put("llmTemperature", settingsService.getLlmTemperature());
        settings.put("llmMaxTokens", settingsService.getLlmMaxTokens());
        settings.put("llmHasApiKey", !settingsService.getLlmApiKey().isEmpty());

        // Analysis settings
        settings.put("autoAnalysisEnabled", settingsService.isAutoAnalysisEnabled());
        settings.put("mergeCheckEnabled", settingsService.isMergeCheckEnabled());
        settings.put("mergeCheckMaxCritical", settingsService.getMergeCheckMaxCritical());
        settings.put("minConfidenceThreshold", settingsService.getMinConfidenceThreshold());

        // File settings
        settings.put("excludedFilePatterns", settingsService.getExcludedFilePatterns());
        settings.put("supportedLanguages", settingsService.getSupportedLanguages());
        settings.put("maxFilesPerAnalysis", settingsService.getMaxFilesPerAnalysis());
        settings.put("maxFileSizeKb", settingsService.getMaxFileSizeKb());

        return Response.ok(gson.toJson(settings)).build();
    }

    /**
     * Update plugin settings.
     *
     * PUT /rest/code-suggestion/1.0/admin/settings
     */
    @PUT
    @Path("/settings")
    public Response updateSettings(String requestBody) {
        try {
            Map<String, Object> settings = gson.fromJson(requestBody, Map.class);

            // LLM settings
            if (settings.containsKey("llmEndpoint")) {
                settingsService.setLlmEndpoint((String) settings.get("llmEndpoint"));
            }
            if (settings.containsKey("llmApiKey")) {
                String apiKey = (String) settings.get("llmApiKey");
                if (apiKey != null && !apiKey.isEmpty()) {
                    settingsService.setLlmApiKey(apiKey);
                }
            }
            if (settings.containsKey("llmModel")) {
                settingsService.setLlmModel((String) settings.get("llmModel"));
            }
            if (settings.containsKey("llmTemperature")) {
                settingsService.setLlmTemperature(((Number) settings.get("llmTemperature")).doubleValue());
            }
            if (settings.containsKey("llmMaxTokens")) {
                settingsService.setLlmMaxTokens(((Number) settings.get("llmMaxTokens")).intValue());
            }

            // Analysis settings
            if (settings.containsKey("autoAnalysisEnabled")) {
                settingsService.setAutoAnalysisEnabled((Boolean) settings.get("autoAnalysisEnabled"));
            }
            if (settings.containsKey("mergeCheckEnabled")) {
                settingsService.setMergeCheckEnabled((Boolean) settings.get("mergeCheckEnabled"));
            }
            if (settings.containsKey("mergeCheckMaxCritical")) {
                settingsService.setMergeCheckMaxCritical(((Number) settings.get("mergeCheckMaxCritical")).intValue());
            }
            if (settings.containsKey("minConfidenceThreshold")) {
                settingsService.setMinConfidenceThreshold(((Number) settings.get("minConfidenceThreshold")).doubleValue());
            }

            // File settings
            if (settings.containsKey("excludedFilePatterns")) {
                settingsService.setExcludedFilePatterns((String) settings.get("excludedFilePatterns"));
            }
            if (settings.containsKey("supportedLanguages")) {
                settingsService.setSupportedLanguages((String) settings.get("supportedLanguages"));
            }
            if (settings.containsKey("maxFilesPerAnalysis")) {
                settingsService.setMaxFilesPerAnalysis(((Number) settings.get("maxFilesPerAnalysis")).intValue());
            }
            if (settings.containsKey("maxFileSizeKb")) {
                settingsService.setMaxFileSizeKb(((Number) settings.get("maxFileSizeKb")).intValue());
            }

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "설정이 저장되었습니다.");
            return Response.ok(gson.toJson(result)).build();

        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", "설정 저장 실패: " + e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(gson.toJson(error)).build();
        }
    }

    /**
     * Test LLM connection.
     *
     * POST /rest/code-suggestion/1.0/admin/test-connection
     */
    @POST
    @Path("/test-connection")
    public Response testConnection() {
        Map<String, Object> result = new HashMap<>();

        boolean healthy = llmClientService.healthCheck();
        result.put("success", healthy);
        result.put("endpoint", settingsService.getLlmEndpoint());
        result.put("model", settingsService.getLlmModel());

        if (healthy) {
            result.put("message", "LLM 서비스 연결에 성공했습니다.");
        } else {
            result.put("message", "LLM 서비스 연결에 실패했습니다. 엔드포인트 및 네트워크 설정을 확인해주세요.");
        }

        return Response.ok(gson.toJson(result)).build();
    }
}

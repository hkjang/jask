package com.jask.bitbucket.service;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.jask.bitbucket.config.PluginSettingsService;
import com.jask.bitbucket.model.LlmRequest;
import com.atlassian.plugin.spring.scanner.annotation.export.ExportAsService;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.inject.Named;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * LLM client implementation supporting Ollama, vLLM, and OpenAI-compatible APIs.
 */
@ExportAsService({LlmClientService.class})
@Named("llmClientService")
public class LlmClientServiceImpl implements LlmClientService {

    private static final Logger log = LoggerFactory.getLogger(LlmClientServiceImpl.class);
    private static final MediaType JSON_MEDIA_TYPE = MediaType.parse("application/json; charset=utf-8");
    private static final int CONNECT_TIMEOUT_SECONDS = 30;
    private static final int READ_TIMEOUT_SECONDS = 120;

    private final PluginSettingsService settingsService;
    private final OkHttpClient httpClient;
    private final Gson gson;

    @Inject
    public LlmClientServiceImpl(PluginSettingsService settingsService) {
        this.settingsService = settingsService;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .readTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .writeTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .build();
        this.gson = new Gson();
    }

    @Override
    public String chat(LlmRequest request) throws LlmException {
        String endpoint = settingsService.getLlmEndpoint();
        String apiKey = settingsService.getLlmApiKey();

        if (request.getModel() == null || request.getModel().isEmpty()) {
            request.setModel(settingsService.getLlmModel());
        }
        if (request.getTemperature() == 0) {
            request.setTemperature(settingsService.getLlmTemperature());
        }
        if (request.getMaxTokens() == 0) {
            request.setMaxTokens(settingsService.getLlmMaxTokens());
        }

        String requestBody = buildRequestBody(request, endpoint);

        Request.Builder httpRequestBuilder = new Request.Builder()
                .url(endpoint)
                .post(RequestBody.create(requestBody, JSON_MEDIA_TYPE));

        if (apiKey != null && !apiKey.isEmpty()) {
            httpRequestBuilder.addHeader("Authorization", "Bearer " + apiKey);
        }
        httpRequestBuilder.addHeader("Content-Type", "application/json");

        try (Response response = httpClient.newCall(httpRequestBuilder.build()).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "응답 없음";
                log.error("LLM API 호출 실패: status={}, body={}", response.code(), errorBody);
                throw new LlmException("LLM API 호출 실패: " + response.code(), response.code());
            }

            String responseBody = response.body() != null ? response.body().string() : "";
            return extractResponse(responseBody, endpoint);
        } catch (IOException e) {
            log.error("LLM API 통신 오류: {}", e.getMessage(), e);
            throw new LlmException("LLM API 통신 오류: " + e.getMessage(), e);
        }
    }

    @Override
    public boolean healthCheck() {
        String endpoint = settingsService.getLlmEndpoint();
        String healthUrl = endpoint.replaceAll("/api/chat$", "/api/tags")
                .replaceAll("/v1/chat/completions$", "/v1/models");

        Request request = new Request.Builder()
                .url(healthUrl)
                .get()
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            return response.isSuccessful();
        } catch (IOException e) {
            log.warn("LLM 헬스체크 실패: {}", e.getMessage());
            return false;
        }
    }

    private String buildRequestBody(LlmRequest request, String endpoint) {
        JsonObject body = new JsonObject();

        if (isOllamaEndpoint(endpoint)) {
            body.addProperty("model", request.getModel());
            body.addProperty("stream", false);

            JsonObject options = new JsonObject();
            options.addProperty("temperature", request.getTemperature());
            options.addProperty("num_predict", request.getMaxTokens());
            body.add("options", options);

            JsonArray messages = new JsonArray();
            for (LlmRequest.Message msg : request.getMessages()) {
                JsonObject m = new JsonObject();
                m.addProperty("role", msg.getRole());
                m.addProperty("content", msg.getContent());
                messages.add(m);
            }
            body.add("messages", messages);
        } else {
            // OpenAI-compatible format (vLLM, OpenAI, etc.)
            body.addProperty("model", request.getModel());
            body.addProperty("temperature", request.getTemperature());
            body.addProperty("max_tokens", request.getMaxTokens());

            JsonArray messages = new JsonArray();
            for (LlmRequest.Message msg : request.getMessages()) {
                JsonObject m = new JsonObject();
                m.addProperty("role", msg.getRole());
                m.addProperty("content", msg.getContent());
                messages.add(m);
            }
            body.add("messages", messages);
        }

        return gson.toJson(body);
    }

    private String extractResponse(String responseBody, String endpoint) {
        try {
            JsonObject json = JsonParser.parseString(responseBody).getAsJsonObject();

            if (isOllamaEndpoint(endpoint)) {
                if (json.has("message")) {
                    return json.getAsJsonObject("message").get("content").getAsString();
                }
            } else {
                // OpenAI-compatible format
                if (json.has("choices")) {
                    JsonArray choices = json.getAsJsonArray("choices");
                    if (choices.size() > 0) {
                        return choices.get(0).getAsJsonObject()
                                .getAsJsonObject("message")
                                .get("content").getAsString();
                    }
                }
            }

            log.warn("LLM 응답에서 콘텐츠를 추출할 수 없음: {}", responseBody);
            return responseBody;
        } catch (Exception e) {
            log.warn("LLM 응답 파싱 실패, 원본 반환: {}", e.getMessage());
            return responseBody;
        }
    }

    private boolean isOllamaEndpoint(String endpoint) {
        return endpoint != null && endpoint.contains("/api/chat");
    }
}

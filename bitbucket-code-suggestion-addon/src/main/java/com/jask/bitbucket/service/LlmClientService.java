package com.jask.bitbucket.service;

import com.jask.bitbucket.model.LlmRequest;

/**
 * Service interface for communicating with LLM providers (Ollama, vLLM, OpenAI-compatible).
 */
public interface LlmClientService {

    /**
     * Send a chat completion request to the LLM.
     *
     * @param request the LLM request with messages and parameters
     * @return the generated response text
     * @throws LlmException if the request fails
     */
    String chat(LlmRequest request) throws LlmException;

    /**
     * Check if the LLM service is reachable and responding.
     *
     * @return true if the LLM is healthy
     */
    boolean healthCheck();

    class LlmException extends RuntimeException {
        private final int statusCode;

        public LlmException(String message) {
            super(message);
            this.statusCode = -1;
        }

        public LlmException(String message, int statusCode) {
            super(message);
            this.statusCode = statusCode;
        }

        public LlmException(String message, Throwable cause) {
            super(message, cause);
            this.statusCode = -1;
        }

        public int getStatusCode() {
            return statusCode;
        }
    }
}

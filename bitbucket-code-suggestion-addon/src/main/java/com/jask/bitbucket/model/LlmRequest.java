package com.jask.bitbucket.model;

import java.io.Serializable;
import java.util.List;

/**
 * Request model for LLM API calls.
 */
public class LlmRequest implements Serializable {
    private static final long serialVersionUID = 1L;

    private String model;
    private List<Message> messages;
    private double temperature;
    private int maxTokens;
    private String responseFormat;

    public static class Message implements Serializable {
        private static final long serialVersionUID = 1L;
        private String role;
        private String content;

        public Message() {}
        public Message(String role, String content) {
            this.role = role;
            this.content = content;
        }

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public List<Message> getMessages() { return messages; }
    public void setMessages(List<Message> messages) { this.messages = messages; }

    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }

    public int getMaxTokens() { return maxTokens; }
    public void setMaxTokens(int maxTokens) { this.maxTokens = maxTokens; }

    public String getResponseFormat() { return responseFormat; }
    public void setResponseFormat(String responseFormat) { this.responseFormat = responseFormat; }
}

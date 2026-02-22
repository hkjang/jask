package com.jask.bitbucket.config;

/**
 * Service interface for managing plugin settings.
 */
public interface PluginSettingsService {

    String getLlmEndpoint();
    void setLlmEndpoint(String endpoint);

    String getLlmApiKey();
    void setLlmApiKey(String apiKey);

    String getLlmModel();
    void setLlmModel(String model);

    double getLlmTemperature();
    void setLlmTemperature(double temperature);

    int getLlmMaxTokens();
    void setLlmMaxTokens(int maxTokens);

    boolean isAutoAnalysisEnabled();
    void setAutoAnalysisEnabled(boolean enabled);

    boolean isMergeCheckEnabled();
    void setMergeCheckEnabled(boolean enabled);

    int getMergeCheckMaxCritical();
    void setMergeCheckMaxCritical(int maxCritical);

    double getMinConfidenceThreshold();
    void setMinConfidenceThreshold(double threshold);

    String getExcludedFilePatterns();
    void setExcludedFilePatterns(String patterns);

    String getSupportedLanguages();
    void setSupportedLanguages(String languages);

    int getMaxFilesPerAnalysis();
    void setMaxFilesPerAnalysis(int maxFiles);

    int getMaxFileSizeKb();
    void setMaxFileSizeKb(int maxSizeKb);
}

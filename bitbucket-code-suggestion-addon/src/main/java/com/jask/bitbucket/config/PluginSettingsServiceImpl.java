package com.jask.bitbucket.config;

import com.atlassian.plugin.spring.scanner.annotation.export.ExportAsService;
import com.atlassian.plugin.spring.scanner.annotation.imports.ComponentImport;
import com.atlassian.sal.api.pluginsettings.PluginSettings;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.inject.Named;

/**
 * Implementation of plugin settings service using SAL PluginSettings.
 */
@ExportAsService({PluginSettingsService.class})
@Named("pluginSettingsService")
public class PluginSettingsServiceImpl implements PluginSettingsService {

    private static final Logger log = LoggerFactory.getLogger(PluginSettingsServiceImpl.class);
    private static final String SETTINGS_PREFIX = "com.jask.bitbucket.code-suggestion.";

    // Default values
    private static final String DEFAULT_LLM_ENDPOINT = "http://localhost:11434/api/chat";
    private static final String DEFAULT_LLM_MODEL = "codellama:13b";
    private static final double DEFAULT_TEMPERATURE = 0.1;
    private static final int DEFAULT_MAX_TOKENS = 4096;
    private static final double DEFAULT_MIN_CONFIDENCE = 0.7;
    private static final int DEFAULT_MAX_FILES = 50;
    private static final int DEFAULT_MAX_FILE_SIZE_KB = 500;
    private static final int DEFAULT_MAX_CRITICAL = 0;
    private static final String DEFAULT_EXCLUDED_PATTERNS = "*.min.js,*.min.css,*.map,*.lock,package-lock.json,yarn.lock";
    private static final String DEFAULT_LANGUAGES = "java,javascript,typescript,python,go,kotlin,scala,ruby,php,csharp,cpp,c,rust,swift";

    private final PluginSettingsFactory pluginSettingsFactory;

    @Inject
    public PluginSettingsServiceImpl(@ComponentImport PluginSettingsFactory pluginSettingsFactory) {
        this.pluginSettingsFactory = pluginSettingsFactory;
    }

    private PluginSettings getSettings() {
        return pluginSettingsFactory.createGlobalSettings();
    }

    private String get(String key, String defaultValue) {
        String value = (String) getSettings().get(SETTINGS_PREFIX + key);
        return value != null ? value : defaultValue;
    }

    private void set(String key, String value) {
        getSettings().put(SETTINGS_PREFIX + key, value);
    }

    @Override
    public String getLlmEndpoint() {
        return get("llm.endpoint", DEFAULT_LLM_ENDPOINT);
    }

    @Override
    public void setLlmEndpoint(String endpoint) {
        set("llm.endpoint", endpoint);
    }

    @Override
    public String getLlmApiKey() {
        return get("llm.apiKey", "");
    }

    @Override
    public void setLlmApiKey(String apiKey) {
        set("llm.apiKey", apiKey);
    }

    @Override
    public String getLlmModel() {
        return get("llm.model", DEFAULT_LLM_MODEL);
    }

    @Override
    public void setLlmModel(String model) {
        set("llm.model", model);
    }

    @Override
    public double getLlmTemperature() {
        try {
            return Double.parseDouble(get("llm.temperature", String.valueOf(DEFAULT_TEMPERATURE)));
        } catch (NumberFormatException e) {
            return DEFAULT_TEMPERATURE;
        }
    }

    @Override
    public void setLlmTemperature(double temperature) {
        set("llm.temperature", String.valueOf(temperature));
    }

    @Override
    public int getLlmMaxTokens() {
        try {
            return Integer.parseInt(get("llm.maxTokens", String.valueOf(DEFAULT_MAX_TOKENS)));
        } catch (NumberFormatException e) {
            return DEFAULT_MAX_TOKENS;
        }
    }

    @Override
    public void setLlmMaxTokens(int maxTokens) {
        set("llm.maxTokens", String.valueOf(maxTokens));
    }

    @Override
    public boolean isAutoAnalysisEnabled() {
        return Boolean.parseBoolean(get("autoAnalysis.enabled", "true"));
    }

    @Override
    public void setAutoAnalysisEnabled(boolean enabled) {
        set("autoAnalysis.enabled", String.valueOf(enabled));
    }

    @Override
    public boolean isMergeCheckEnabled() {
        return Boolean.parseBoolean(get("mergeCheck.enabled", "false"));
    }

    @Override
    public void setMergeCheckEnabled(boolean enabled) {
        set("mergeCheck.enabled", String.valueOf(enabled));
    }

    @Override
    public int getMergeCheckMaxCritical() {
        try {
            return Integer.parseInt(get("mergeCheck.maxCritical", String.valueOf(DEFAULT_MAX_CRITICAL)));
        } catch (NumberFormatException e) {
            return DEFAULT_MAX_CRITICAL;
        }
    }

    @Override
    public void setMergeCheckMaxCritical(int maxCritical) {
        set("mergeCheck.maxCritical", String.valueOf(maxCritical));
    }

    @Override
    public double getMinConfidenceThreshold() {
        try {
            return Double.parseDouble(get("minConfidence", String.valueOf(DEFAULT_MIN_CONFIDENCE)));
        } catch (NumberFormatException e) {
            return DEFAULT_MIN_CONFIDENCE;
        }
    }

    @Override
    public void setMinConfidenceThreshold(double threshold) {
        set("minConfidence", String.valueOf(threshold));
    }

    @Override
    public String getExcludedFilePatterns() {
        return get("excludedPatterns", DEFAULT_EXCLUDED_PATTERNS);
    }

    @Override
    public void setExcludedFilePatterns(String patterns) {
        set("excludedPatterns", patterns);
    }

    @Override
    public String getSupportedLanguages() {
        return get("supportedLanguages", DEFAULT_LANGUAGES);
    }

    @Override
    public void setSupportedLanguages(String languages) {
        set("supportedLanguages", languages);
    }

    @Override
    public int getMaxFilesPerAnalysis() {
        try {
            return Integer.parseInt(get("maxFiles", String.valueOf(DEFAULT_MAX_FILES)));
        } catch (NumberFormatException e) {
            return DEFAULT_MAX_FILES;
        }
    }

    @Override
    public void setMaxFilesPerAnalysis(int maxFiles) {
        set("maxFiles", String.valueOf(maxFiles));
    }

    @Override
    public int getMaxFileSizeKb() {
        try {
            return Integer.parseInt(get("maxFileSizeKb", String.valueOf(DEFAULT_MAX_FILE_SIZE_KB)));
        } catch (NumberFormatException e) {
            return DEFAULT_MAX_FILE_SIZE_KB;
        }
    }

    @Override
    public void setMaxFileSizeKb(int maxSizeKb) {
        set("maxFileSizeKb", String.valueOf(maxSizeKb));
    }
}

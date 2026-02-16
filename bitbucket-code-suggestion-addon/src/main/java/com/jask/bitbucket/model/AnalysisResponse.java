package com.jask.bitbucket.model;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

/**
 * Response model from code analysis.
 */
public class AnalysisResponse implements Serializable {
    private static final long serialVersionUID = 1L;

    private boolean success;
    private long pullRequestId;
    private int repositoryId;
    private List<CodeSuggestion> suggestions;
    private AnalysisSummary summary;
    private String error;
    private long analysisTimeMs;

    public static class AnalysisSummary implements Serializable {
        private static final long serialVersionUID = 1L;
        private int totalFiles;
        private int totalSuggestions;
        private int criticalCount;
        private int warningCount;
        private int infoCount;
        private int hintCount;
        private Map<String, Integer> categoryBreakdown;
        private double overallScore; // 0-100 code quality score

        public int getTotalFiles() { return totalFiles; }
        public void setTotalFiles(int totalFiles) { this.totalFiles = totalFiles; }

        public int getTotalSuggestions() { return totalSuggestions; }
        public void setTotalSuggestions(int totalSuggestions) { this.totalSuggestions = totalSuggestions; }

        public int getCriticalCount() { return criticalCount; }
        public void setCriticalCount(int criticalCount) { this.criticalCount = criticalCount; }

        public int getWarningCount() { return warningCount; }
        public void setWarningCount(int warningCount) { this.warningCount = warningCount; }

        public int getInfoCount() { return infoCount; }
        public void setInfoCount(int infoCount) { this.infoCount = infoCount; }

        public int getHintCount() { return hintCount; }
        public void setHintCount(int hintCount) { this.hintCount = hintCount; }

        public Map<String, Integer> getCategoryBreakdown() { return categoryBreakdown; }
        public void setCategoryBreakdown(Map<String, Integer> categoryBreakdown) {
            this.categoryBreakdown = categoryBreakdown;
        }

        public double getOverallScore() { return overallScore; }
        public void setOverallScore(double overallScore) { this.overallScore = overallScore; }
    }

    // Getters and Setters
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public long getPullRequestId() { return pullRequestId; }
    public void setPullRequestId(long pullRequestId) { this.pullRequestId = pullRequestId; }

    public int getRepositoryId() { return repositoryId; }
    public void setRepositoryId(int repositoryId) { this.repositoryId = repositoryId; }

    public List<CodeSuggestion> getSuggestions() { return suggestions; }
    public void setSuggestions(List<CodeSuggestion> suggestions) { this.suggestions = suggestions; }

    public AnalysisSummary getSummary() { return summary; }
    public void setSummary(AnalysisSummary summary) { this.summary = summary; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public long getAnalysisTimeMs() { return analysisTimeMs; }
    public void setAnalysisTimeMs(long analysisTimeMs) { this.analysisTimeMs = analysisTimeMs; }
}

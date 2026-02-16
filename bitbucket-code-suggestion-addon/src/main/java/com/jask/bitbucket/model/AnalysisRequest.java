package com.jask.bitbucket.model;

import java.io.Serializable;
import java.util.List;

/**
 * Request model for code analysis.
 */
public class AnalysisRequest implements Serializable {
    private static final long serialVersionUID = 1L;

    private int repositoryId;
    private long pullRequestId;
    private String projectKey;
    private String repositorySlug;
    private List<FileDiff> fileDiffs;
    private AnalysisOptions options;

    public static class FileDiff implements Serializable {
        private static final long serialVersionUID = 1L;
        private String filePath;
        private String language;
        private String diff;
        private String fullContent;
        private List<HunkRange> hunks;

        public String getFilePath() { return filePath; }
        public void setFilePath(String filePath) { this.filePath = filePath; }

        public String getLanguage() { return language; }
        public void setLanguage(String language) { this.language = language; }

        public String getDiff() { return diff; }
        public void setDiff(String diff) { this.diff = diff; }

        public String getFullContent() { return fullContent; }
        public void setFullContent(String fullContent) { this.fullContent = fullContent; }

        public List<HunkRange> getHunks() { return hunks; }
        public void setHunks(List<HunkRange> hunks) { this.hunks = hunks; }
    }

    public static class HunkRange implements Serializable {
        private static final long serialVersionUID = 1L;
        private int startLine;
        private int endLine;

        public HunkRange() {}
        public HunkRange(int startLine, int endLine) {
            this.startLine = startLine;
            this.endLine = endLine;
        }

        public int getStartLine() { return startLine; }
        public void setStartLine(int startLine) { this.startLine = startLine; }

        public int getEndLine() { return endLine; }
        public void setEndLine(int endLine) { this.endLine = endLine; }
    }

    public static class AnalysisOptions implements Serializable {
        private static final long serialVersionUID = 1L;
        private boolean checkSecurity = true;
        private boolean checkPerformance = true;
        private boolean checkStyle = true;
        private boolean checkBestPractice = true;
        private boolean checkErrorHandling = true;
        private double minConfidence = 0.7;

        public boolean isCheckSecurity() { return checkSecurity; }
        public void setCheckSecurity(boolean checkSecurity) { this.checkSecurity = checkSecurity; }

        public boolean isCheckPerformance() { return checkPerformance; }
        public void setCheckPerformance(boolean checkPerformance) { this.checkPerformance = checkPerformance; }

        public boolean isCheckStyle() { return checkStyle; }
        public void setCheckStyle(boolean checkStyle) { this.checkStyle = checkStyle; }

        public boolean isCheckBestPractice() { return checkBestPractice; }
        public void setCheckBestPractice(boolean checkBestPractice) { this.checkBestPractice = checkBestPractice; }

        public boolean isCheckErrorHandling() { return checkErrorHandling; }
        public void setCheckErrorHandling(boolean checkErrorHandling) { this.checkErrorHandling = checkErrorHandling; }

        public double getMinConfidence() { return minConfidence; }
        public void setMinConfidence(double minConfidence) { this.minConfidence = minConfidence; }
    }

    // Getters and Setters
    public int getRepositoryId() { return repositoryId; }
    public void setRepositoryId(int repositoryId) { this.repositoryId = repositoryId; }

    public long getPullRequestId() { return pullRequestId; }
    public void setPullRequestId(long pullRequestId) { this.pullRequestId = pullRequestId; }

    public String getProjectKey() { return projectKey; }
    public void setProjectKey(String projectKey) { this.projectKey = projectKey; }

    public String getRepositorySlug() { return repositorySlug; }
    public void setRepositorySlug(String repositorySlug) { this.repositorySlug = repositorySlug; }

    public List<FileDiff> getFileDiffs() { return fileDiffs; }
    public void setFileDiffs(List<FileDiff> fileDiffs) { this.fileDiffs = fileDiffs; }

    public AnalysisOptions getOptions() { return options; }
    public void setOptions(AnalysisOptions options) { this.options = options; }
}

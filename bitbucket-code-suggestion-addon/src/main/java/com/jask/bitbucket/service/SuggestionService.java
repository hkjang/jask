package com.jask.bitbucket.service;

import com.jask.bitbucket.model.CodeSuggestion;

import java.util.List;

/**
 * Service interface for managing code suggestions (CRUD operations via Active Objects).
 */
public interface SuggestionService {

    /**
     * Save suggestions from an analysis result.
     */
    List<CodeSuggestion> saveSuggestions(long pullRequestId, int repositoryId, List<CodeSuggestion> suggestions);

    /**
     * Get all suggestions for a pull request.
     */
    List<CodeSuggestion> getSuggestions(long pullRequestId, int repositoryId);

    /**
     * Get suggestions for a specific file in a pull request.
     */
    List<CodeSuggestion> getSuggestionsForFile(long pullRequestId, int repositoryId, String filePath);

    /**
     * Update the status of a suggestion (ACCEPTED, REJECTED, DISMISSED).
     */
    CodeSuggestion updateSuggestionStatus(long suggestionId, String status, String resolvedBy);

    /**
     * Delete all suggestions for a pull request.
     */
    void deleteSuggestions(long pullRequestId, int repositoryId);

    /**
     * Count critical suggestions for a pull request.
     */
    int countCriticalSuggestions(long pullRequestId, int repositoryId);

    /**
     * Get statistics for a pull request.
     */
    SuggestionStats getStats(long pullRequestId, int repositoryId);

    class SuggestionStats {
        private int total;
        private int pending;
        private int accepted;
        private int rejected;
        private int dismissed;
        private int critical;
        private int warning;

        public int getTotal() { return total; }
        public void setTotal(int total) { this.total = total; }

        public int getPending() { return pending; }
        public void setPending(int pending) { this.pending = pending; }

        public int getAccepted() { return accepted; }
        public void setAccepted(int accepted) { this.accepted = accepted; }

        public int getRejected() { return rejected; }
        public void setRejected(int rejected) { this.rejected = rejected; }

        public int getDismissed() { return dismissed; }
        public void setDismissed(int dismissed) { this.dismissed = dismissed; }

        public int getCritical() { return critical; }
        public void setCritical(int critical) { this.critical = critical; }

        public int getWarning() { return warning; }
        public void setWarning(int warning) { this.warning = warning; }
    }
}

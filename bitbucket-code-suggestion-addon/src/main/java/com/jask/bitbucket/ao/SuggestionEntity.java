package com.jask.bitbucket.ao;

import net.java.ao.Entity;
import net.java.ao.Preload;
import net.java.ao.schema.Indexed;
import net.java.ao.schema.StringLength;
import net.java.ao.schema.Table;

/**
 * Active Objects entity for persisting code suggestions.
 */
@Table("JASK_SUGGESTION")
@Preload
public interface SuggestionEntity extends Entity {

    @Indexed
    long getPullRequestId();
    void setPullRequestId(long pullRequestId);

    @Indexed
    int getRepositoryId();
    void setRepositoryId(int repositoryId);

    String getFilePath();
    void setFilePath(String filePath);

    int getStartLine();
    void setStartLine(int startLine);

    int getEndLine();
    void setEndLine(int endLine);

    @StringLength(StringLength.UNLIMITED)
    String getOriginalCode();
    void setOriginalCode(String originalCode);

    @StringLength(StringLength.UNLIMITED)
    String getSuggestedCode();
    void setSuggestedCode(String suggestedCode);

    @StringLength(StringLength.UNLIMITED)
    String getExplanation();
    void setExplanation(String explanation);

    String getSeverity();
    void setSeverity(String severity);

    String getCategory();
    void setCategory(String category);

    double getConfidence();
    void setConfidence(double confidence);

    @Indexed
    String getStatus();
    void setStatus(String status);

    long getCreatedAt();
    void setCreatedAt(long createdAt);

    String getResolvedBy();
    void setResolvedBy(String resolvedBy);

    long getResolvedAt();
    void setResolvedAt(long resolvedAt);
}

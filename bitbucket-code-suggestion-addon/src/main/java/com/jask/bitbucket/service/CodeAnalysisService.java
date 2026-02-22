package com.jask.bitbucket.service;

import com.jask.bitbucket.model.AnalysisRequest;
import com.jask.bitbucket.model.AnalysisResponse;

/**
 * Service interface for analyzing code diffs and generating suggestions.
 */
public interface CodeAnalysisService {

    /**
     * Analyze code diffs from a pull request and generate improvement suggestions.
     *
     * @param request the analysis request containing file diffs
     * @return analysis response with suggestions
     */
    AnalysisResponse analyze(AnalysisRequest request);

    /**
     * Analyze a single file diff.
     *
     * @param fileDiff the file diff to analyze
     * @param language the programming language
     * @return analysis response for this file
     */
    AnalysisResponse analyzeFile(AnalysisRequest.FileDiff fileDiff, String language);
}

package com.jask.bitbucket.hook;

import com.atlassian.bitbucket.pull.PullRequest;
import com.atlassian.plugin.web.ContextProvider;
import com.jask.bitbucket.model.CodeSuggestion;
import com.jask.bitbucket.service.SuggestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.inject.Named;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Context provider for Soy templates, supplies suggestion data to web panels.
 */
@Named("suggestionContextProvider")
public class SuggestionContextProvider implements ContextProvider {

    private static final Logger log = LoggerFactory.getLogger(SuggestionContextProvider.class);

    private final SuggestionService suggestionService;

    @Inject
    public SuggestionContextProvider(SuggestionService suggestionService) {
        this.suggestionService = suggestionService;
    }

    @Override
    public void init(Map<String, String> params) {
        // No initialization needed
    }

    @Override
    public Map<String, Object> getContextMap(Map<String, Object> context) {
        Map<String, Object> result = new HashMap<>(context);

        try {
            PullRequest pr = (PullRequest) context.get("pullRequest");
            if (pr != null) {
                int repoId = pr.getToRef().getRepository().getId();

                List<CodeSuggestion> suggestions =
                        suggestionService.getSuggestions(pr.getId(), repoId);

                SuggestionService.SuggestionStats stats =
                        suggestionService.getStats(pr.getId(), repoId);

                result.put("suggestions", suggestions);
                result.put("suggestionStats", stats);
                result.put("hasSuggestions", !suggestions.isEmpty());
                result.put("pullRequestId", pr.getId());
                result.put("repositoryId", repoId);
            }
        } catch (Exception e) {
            log.warn("코드 제안 컨텍스트 로딩 실패: {}", e.getMessage());
            result.put("hasSuggestions", false);
        }

        return result;
    }
}

package com.jask.bitbucket.hook;

import com.atlassian.bitbucket.hook.repository.PreRepositoryHookContext;
import com.atlassian.bitbucket.hook.repository.PullRequestMergeHookRequest;
import com.atlassian.bitbucket.hook.repository.RepositoryMergeCheck;
import com.atlassian.bitbucket.pull.PullRequest;
import com.jask.bitbucket.config.PluginSettingsService;
import com.jask.bitbucket.service.SuggestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.annotation.Nonnull;
import javax.inject.Inject;
import javax.inject.Named;

/**
 * Merge check that blocks merging when critical code suggestions are unresolved.
 */
@Named("codeSuggestionMergeCheck")
public class CodeSuggestionMergeCheck implements RepositoryMergeCheck {

    private static final Logger log = LoggerFactory.getLogger(CodeSuggestionMergeCheck.class);

    private final SuggestionService suggestionService;
    private final PluginSettingsService settingsService;

    @Inject
    public CodeSuggestionMergeCheck(SuggestionService suggestionService,
                                     PluginSettingsService settingsService) {
        this.suggestionService = suggestionService;
        this.settingsService = settingsService;
    }

    @Override
    public void check(@Nonnull PreRepositoryHookContext context,
                       @Nonnull PullRequestMergeHookRequest request) {
        if (!settingsService.isMergeCheckEnabled()) {
            return;
        }

        PullRequest pr = request.getPullRequest();
        int repoId = pr.getToRef().getRepository().getId();
        int maxCritical = settingsService.getMergeCheckMaxCritical();

        int criticalCount = suggestionService.countCriticalSuggestions(pr.getId(), repoId);

        if (criticalCount > maxCritical) {
            String message = String.format(
                    "머지가 차단되었습니다: %d 건의 심각한(CRITICAL) 코드 제안이 해결되지 않았습니다. " +
                    "(허용 기준: %d 건 이하) 'AI 코드 제안' 탭에서 해당 제안을 확인하고 처리해주세요.",
                    criticalCount, maxCritical);

            context.getMergeRequest().veto(
                    "코드 제안 머지 체크",
                    message);

            log.info("PR #{} 머지 차단: {} 건의 미해결 CRITICAL 제안", pr.getId(), criticalCount);
        } else {
            SuggestionService.SuggestionStats stats =
                    suggestionService.getStats(pr.getId(), repoId);

            log.info("PR #{} 머지 체크 통과: CRITICAL={}, WARNING={}, 총={}",
                    pr.getId(), stats.getCritical(), stats.getWarning(), stats.getTotal());
        }
    }
}

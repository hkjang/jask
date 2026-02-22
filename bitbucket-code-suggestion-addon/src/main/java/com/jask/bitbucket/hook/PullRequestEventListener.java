package com.jask.bitbucket.hook;

import com.atlassian.bitbucket.content.ContentService;
import com.atlassian.bitbucket.content.DiffContentCallback;
import com.atlassian.bitbucket.event.pull.PullRequestOpenedEvent;
import com.atlassian.bitbucket.event.pull.PullRequestRescoped;
import com.atlassian.bitbucket.pull.PullRequest;
import com.atlassian.bitbucket.pull.PullRequestChangesRequest;
import com.atlassian.bitbucket.pull.PullRequestService;
import com.atlassian.bitbucket.content.Change;
import com.atlassian.bitbucket.content.ChangesRequest;
import com.atlassian.bitbucket.util.PageRequest;
import com.atlassian.bitbucket.util.PageRequestImpl;
import com.atlassian.event.api.EventListener;
import com.atlassian.event.api.EventPublisher;
import com.atlassian.plugin.spring.scanner.annotation.imports.ComponentImport;
import com.jask.bitbucket.config.PluginSettingsService;
import com.jask.bitbucket.model.AnalysisRequest;
import com.jask.bitbucket.model.AnalysisResponse;
import com.jask.bitbucket.model.CodeSuggestion;
import com.jask.bitbucket.service.CodeAnalysisService;
import com.jask.bitbucket.service.SuggestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import javax.inject.Inject;
import javax.inject.Named;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Listens for Pull Request events and triggers automatic code analysis.
 */
@Named("prEventListener")
public class PullRequestEventListener {

    private static final Logger log = LoggerFactory.getLogger(PullRequestEventListener.class);

    private final EventPublisher eventPublisher;
    private final PullRequestService pullRequestService;
    private final ContentService contentService;
    private final CodeAnalysisService codeAnalysisService;
    private final SuggestionService suggestionService;
    private final PluginSettingsService settingsService;
    private final ExecutorService executorService;

    @Inject
    public PullRequestEventListener(@ComponentImport EventPublisher eventPublisher,
                                     @ComponentImport PullRequestService pullRequestService,
                                     @ComponentImport ContentService contentService,
                                     CodeAnalysisService codeAnalysisService,
                                     SuggestionService suggestionService,
                                     PluginSettingsService settingsService) {
        this.eventPublisher = eventPublisher;
        this.pullRequestService = pullRequestService;
        this.contentService = contentService;
        this.codeAnalysisService = codeAnalysisService;
        this.suggestionService = suggestionService;
        this.settingsService = settingsService;
        this.executorService = Executors.newFixedThreadPool(2);
    }

    @PostConstruct
    public void init() {
        eventPublisher.register(this);
        log.info("Jask 코드 제안 PR 이벤트 리스너 등록 완료");
    }

    @PreDestroy
    public void destroy() {
        eventPublisher.unregister(this);
        executorService.shutdown();
        log.info("Jask 코드 제안 PR 이벤트 리스너 해제 완료");
    }

    /**
     * Handle PR opened event - trigger initial analysis.
     */
    @EventListener
    public void onPullRequestOpened(PullRequestOpenedEvent event) {
        if (!settingsService.isAutoAnalysisEnabled()) {
            log.debug("자동 분석이 비활성화되어 있습니다");
            return;
        }

        PullRequest pr = event.getPullRequest();
        log.info("PR #{} 생성 감지 - 코드 분석 시작: {}", pr.getId(), pr.getTitle());

        executorService.submit(() -> analyzeAndSave(pr));
    }

    /**
     * Handle PR rescoped event (new commits pushed) - re-analyze.
     */
    @EventListener
    public void onPullRequestRescoped(PullRequestRescoped event) {
        if (!settingsService.isAutoAnalysisEnabled()) {
            return;
        }

        PullRequest pr = event.getPullRequest();
        log.info("PR #{} 업데이트 감지 - 재분석 시작: {}", pr.getId(), pr.getTitle());

        executorService.submit(() -> {
            // Clear old suggestions before re-analysis
            suggestionService.deleteSuggestions(
                    pr.getId(),
                    pr.getToRef().getRepository().getId());
            analyzeAndSave(pr);
        });
    }

    /**
     * Extract diffs from PR and run code analysis.
     */
    private void analyzeAndSave(PullRequest pr) {
        try {
            int repoId = pr.getToRef().getRepository().getId();
            String projectKey = pr.getToRef().getRepository().getProject().getKey();
            String repoSlug = pr.getToRef().getRepository().getSlug();

            // Build analysis request from PR changes
            AnalysisRequest request = new AnalysisRequest();
            request.setPullRequestId(pr.getId());
            request.setRepositoryId(repoId);
            request.setProjectKey(projectKey);
            request.setRepositorySlug(repoSlug);

            List<AnalysisRequest.FileDiff> fileDiffs = extractFileDiffs(pr);
            request.setFileDiffs(fileDiffs);

            if (fileDiffs.isEmpty()) {
                log.info("PR #{} 에 분석할 파일이 없습니다", pr.getId());
                return;
            }

            // Run analysis
            AnalysisResponse response = codeAnalysisService.analyze(request);

            if (response.isSuccess() && response.getSuggestions() != null
                    && !response.getSuggestions().isEmpty()) {
                // Save suggestions to database
                suggestionService.saveSuggestions(
                        pr.getId(), repoId, response.getSuggestions());

                log.info("PR #{} 분석 완료: {} 개 제안 생성 ({}ms)",
                        pr.getId(),
                        response.getSuggestions().size(),
                        response.getAnalysisTimeMs());
            } else {
                log.info("PR #{} 분석 완료: 제안 없음", pr.getId());
            }

        } catch (Exception e) {
            log.error("PR #{} 분석 중 오류 발생: {}", pr.getId(), e.getMessage(), e);
        }
    }

    /**
     * Extract file diffs from a pull request.
     */
    private List<AnalysisRequest.FileDiff> extractFileDiffs(PullRequest pr) {
        List<AnalysisRequest.FileDiff> fileDiffs = new ArrayList<>();

        try {
            PullRequestChangesRequest changesRequest = new PullRequestChangesRequest.Builder(pr)
                    .build();

            pullRequestService.streamChanges(changesRequest, change -> {
                try {
                    AnalysisRequest.FileDiff fileDiff = new AnalysisRequest.FileDiff();
                    fileDiff.setFilePath(change.getPath().toString());

                    // Get the diff content
                    ByteArrayOutputStream diffOutput = new ByteArrayOutputStream();
                    contentService.streamDiff(
                            pr.getToRef().getRepository(),
                            pr.getFromRef().getLatestCommit(),
                            pr.getToRef().getLatestCommit(),
                            change.getPath().toString(),
                            new OutputStreamDiffContentCallback(diffOutput));

                    fileDiff.setDiff(diffOutput.toString("UTF-8"));
                    fileDiffs.add(fileDiff);
                } catch (Exception e) {
                    log.warn("파일 diff 추출 실패: {}", change.getPath(), e);
                }

                return true; // continue iteration
            });
        } catch (Exception e) {
            log.error("PR 변경사항 추출 실패: {}", e.getMessage(), e);
        }

        return fileDiffs;
    }

    /**
     * Simple callback to write diff content to an OutputStream.
     */
    private static class OutputStreamDiffContentCallback implements DiffContentCallback {
        private final OutputStream outputStream;

        OutputStreamDiffContentCallback(OutputStream outputStream) {
            this.outputStream = outputStream;
        }

        @Override
        public void onDiffStart(String srcPath, String dstPath) {}

        @Override
        public void onDiffEnd(String srcPath, String dstPath) {}

        @Override
        public void onHunkStart(int srcLine, int srcSpan, int dstLine, int dstSpan, String extra) {}

        @Override
        public void onHunkEnd(int srcLine, int srcSpan, int dstLine, int dstSpan) {}

        @Override
        public void onSegmentStart(DiffContentCallback.SegmentType type) {}

        @Override
        public void onSegmentEnd(DiffContentCallback.SegmentType type) {}

        @Override
        public void onSegmentLine(String line, DiffContentCallback.SegmentType type, int srcLine, int dstLine) {
            try {
                String prefix = switch (type) {
                    case ADDED -> "+";
                    case REMOVED -> "-";
                    default -> " ";
                };
                outputStream.write((prefix + line + "\n").getBytes("UTF-8"));
            } catch (IOException e) {
                // Ignore write errors
            }
        }
    }
}

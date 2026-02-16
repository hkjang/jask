package com.jask.bitbucket.service;

import com.atlassian.activeobjects.external.ActiveObjects;
import com.atlassian.plugin.spring.scanner.annotation.export.ExportAsService;
import com.atlassian.plugin.spring.scanner.annotation.imports.ComponentImport;
import com.jask.bitbucket.ao.SuggestionEntity;
import com.jask.bitbucket.model.CodeSuggestion;
import net.java.ao.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.inject.Named;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Implementation of SuggestionService using Active Objects for persistence.
 */
@ExportAsService({SuggestionService.class})
@Named("suggestionService")
public class SuggestionServiceImpl implements SuggestionService {

    private static final Logger log = LoggerFactory.getLogger(SuggestionServiceImpl.class);

    private final ActiveObjects ao;

    @Inject
    public SuggestionServiceImpl(@ComponentImport ActiveObjects ao) {
        this.ao = ao;
    }

    @Override
    public List<CodeSuggestion> saveSuggestions(long pullRequestId, int repositoryId,
                                                  List<CodeSuggestion> suggestions) {
        List<CodeSuggestion> saved = new ArrayList<>();
        long now = System.currentTimeMillis();

        for (CodeSuggestion suggestion : suggestions) {
            try {
                SuggestionEntity entity = ao.create(SuggestionEntity.class);
                entity.setPullRequestId(pullRequestId);
                entity.setRepositoryId(repositoryId);
                entity.setFilePath(suggestion.getFilePath());
                entity.setStartLine(suggestion.getStartLine());
                entity.setEndLine(suggestion.getEndLine());
                entity.setOriginalCode(suggestion.getOriginalCode());
                entity.setSuggestedCode(suggestion.getSuggestedCode());
                entity.setExplanation(suggestion.getExplanation());
                entity.setSeverity(suggestion.getSeverity() != null ?
                        suggestion.getSeverity().name() : "INFO");
                entity.setCategory(suggestion.getCategory() != null ?
                        suggestion.getCategory().name() : "BEST_PRACTICE");
                entity.setConfidence(suggestion.getConfidence());
                entity.setStatus("PENDING");
                entity.setCreatedAt(now);
                entity.save();

                suggestion.setId(entity.getID());
                suggestion.setStatus("PENDING");
                saved.add(suggestion);
            } catch (Exception e) {
                log.error("제안 저장 실패: {}", e.getMessage(), e);
            }
        }

        log.info("PR #{} (repo={})에 {} 개 제안 저장 완료", pullRequestId, repositoryId, saved.size());
        return saved;
    }

    @Override
    public List<CodeSuggestion> getSuggestions(long pullRequestId, int repositoryId) {
        SuggestionEntity[] entities = ao.find(SuggestionEntity.class,
                Query.select()
                        .where("PULL_REQUEST_ID = ? AND REPOSITORY_ID = ?", pullRequestId, repositoryId)
                        .order("SEVERITY ASC, CONFIDENCE DESC"));

        return Arrays.stream(entities)
                .map(this::toModel)
                .collect(Collectors.toList());
    }

    @Override
    public List<CodeSuggestion> getSuggestionsForFile(long pullRequestId, int repositoryId, String filePath) {
        SuggestionEntity[] entities = ao.find(SuggestionEntity.class,
                Query.select()
                        .where("PULL_REQUEST_ID = ? AND REPOSITORY_ID = ? AND FILE_PATH = ?",
                                pullRequestId, repositoryId, filePath)
                        .order("START_LINE ASC"));

        return Arrays.stream(entities)
                .map(this::toModel)
                .collect(Collectors.toList());
    }

    @Override
    public CodeSuggestion updateSuggestionStatus(long suggestionId, String status, String resolvedBy) {
        SuggestionEntity entity = ao.get(SuggestionEntity.class, (int) suggestionId);
        if (entity == null) {
            throw new IllegalArgumentException("제안을 찾을 수 없습니다: ID=" + suggestionId);
        }

        entity.setStatus(status);
        entity.setResolvedBy(resolvedBy);
        entity.setResolvedAt(System.currentTimeMillis());
        entity.save();

        log.info("제안 #{} 상태 업데이트: {} (처리자: {})", suggestionId, status, resolvedBy);
        return toModel(entity);
    }

    @Override
    public void deleteSuggestions(long pullRequestId, int repositoryId) {
        SuggestionEntity[] entities = ao.find(SuggestionEntity.class,
                Query.select()
                        .where("PULL_REQUEST_ID = ? AND REPOSITORY_ID = ?", pullRequestId, repositoryId));

        for (SuggestionEntity entity : entities) {
            ao.delete(entity);
        }

        log.info("PR #{} (repo={})의 제안 {} 건 삭제 완료", pullRequestId, repositoryId, entities.length);
    }

    @Override
    public int countCriticalSuggestions(long pullRequestId, int repositoryId) {
        SuggestionEntity[] entities = ao.find(SuggestionEntity.class,
                Query.select()
                        .where("PULL_REQUEST_ID = ? AND REPOSITORY_ID = ? AND SEVERITY = ? AND STATUS = ?",
                                pullRequestId, repositoryId, "CRITICAL", "PENDING"));
        return entities.length;
    }

    @Override
    public SuggestionStats getStats(long pullRequestId, int repositoryId) {
        List<CodeSuggestion> all = getSuggestions(pullRequestId, repositoryId);
        SuggestionStats stats = new SuggestionStats();
        stats.setTotal(all.size());

        int pending = 0, accepted = 0, rejected = 0, dismissed = 0, critical = 0, warning = 0;
        for (CodeSuggestion s : all) {
            switch (s.getStatus()) {
                case "PENDING": pending++; break;
                case "ACCEPTED": accepted++; break;
                case "REJECTED": rejected++; break;
                case "DISMISSED": dismissed++; break;
            }
            if (s.getSeverity() == CodeSuggestion.Severity.CRITICAL) critical++;
            if (s.getSeverity() == CodeSuggestion.Severity.WARNING) warning++;
        }

        stats.setPending(pending);
        stats.setAccepted(accepted);
        stats.setRejected(rejected);
        stats.setDismissed(dismissed);
        stats.setCritical(critical);
        stats.setWarning(warning);

        return stats;
    }

    private CodeSuggestion toModel(SuggestionEntity entity) {
        CodeSuggestion model = new CodeSuggestion();
        model.setId(entity.getID());
        model.setPullRequestId(entity.getPullRequestId());
        model.setRepositoryId(entity.getRepositoryId());
        model.setFilePath(entity.getFilePath());
        model.setStartLine(entity.getStartLine());
        model.setEndLine(entity.getEndLine());
        model.setOriginalCode(entity.getOriginalCode());
        model.setSuggestedCode(entity.getSuggestedCode());
        model.setExplanation(entity.getExplanation());

        try {
            model.setSeverity(CodeSuggestion.Severity.valueOf(entity.getSeverity()));
        } catch (Exception e) {
            model.setSeverity(CodeSuggestion.Severity.INFO);
        }

        try {
            model.setCategory(CodeSuggestion.Category.valueOf(entity.getCategory()));
        } catch (Exception e) {
            model.setCategory(CodeSuggestion.Category.BEST_PRACTICE);
        }

        model.setConfidence(entity.getConfidence());
        model.setStatus(entity.getStatus());
        model.setCreatedAt(String.valueOf(entity.getCreatedAt()));
        model.setResolvedBy(entity.getResolvedBy());

        return model;
    }
}

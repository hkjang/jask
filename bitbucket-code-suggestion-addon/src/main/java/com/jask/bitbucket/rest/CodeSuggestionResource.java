package com.jask.bitbucket.rest;

import com.google.gson.Gson;
import com.jask.bitbucket.model.AnalysisRequest;
import com.jask.bitbucket.model.AnalysisResponse;
import com.jask.bitbucket.model.CodeSuggestion;
import com.jask.bitbucket.service.CodeAnalysisService;
import com.jask.bitbucket.service.SuggestionService;

import javax.inject.Inject;
import javax.inject.Named;
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST resource for code suggestion operations.
 *
 * Base path: /rest/code-suggestion/1.0
 */
@Named("codeSuggestionResource")
@Path("/")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CodeSuggestionResource {

    private final CodeAnalysisService codeAnalysisService;
    private final SuggestionService suggestionService;
    private final Gson gson;

    @Inject
    public CodeSuggestionResource(CodeAnalysisService codeAnalysisService,
                                   SuggestionService suggestionService) {
        this.codeAnalysisService = codeAnalysisService;
        this.suggestionService = suggestionService;
        this.gson = new Gson();
    }

    /**
     * Trigger code analysis for a pull request.
     *
     * POST /rest/code-suggestion/1.0/analyze
     */
    @POST
    @Path("/analyze")
    public Response analyzeCode(String requestBody) {
        try {
            AnalysisRequest request = gson.fromJson(requestBody, AnalysisRequest.class);

            if (request.getPullRequestId() == 0 || request.getRepositoryId() == 0) {
                return errorResponse(Response.Status.BAD_REQUEST,
                        "pullRequestId와 repositoryId는 필수입니다.");
            }

            AnalysisResponse response = codeAnalysisService.analyze(request);

            if (response.isSuccess() && response.getSuggestions() != null) {
                // Save suggestions
                suggestionService.saveSuggestions(
                        request.getPullRequestId(),
                        request.getRepositoryId(),
                        response.getSuggestions());
            }

            return Response.ok(gson.toJson(response)).build();
        } catch (Exception e) {
            return errorResponse(Response.Status.INTERNAL_SERVER_ERROR,
                    "코드 분석 중 오류가 발생했습니다: " + e.getMessage());
        }
    }

    /**
     * Get all suggestions for a pull request.
     *
     * GET /rest/code-suggestion/1.0/suggestions/{repoId}/{prId}
     */
    @GET
    @Path("/suggestions/{repoId}/{prId}")
    public Response getSuggestions(@PathParam("repoId") int repoId,
                                    @PathParam("prId") long prId) {
        try {
            List<CodeSuggestion> suggestions = suggestionService.getSuggestions(prId, repoId);

            Map<String, Object> result = new HashMap<>();
            result.put("suggestions", suggestions);
            result.put("total", suggestions.size());
            result.put("stats", suggestionService.getStats(prId, repoId));

            return Response.ok(gson.toJson(result)).build();
        } catch (Exception e) {
            return errorResponse(Response.Status.INTERNAL_SERVER_ERROR,
                    "제안 목록 조회 실패: " + e.getMessage());
        }
    }

    /**
     * Get suggestions for a specific file in a pull request.
     *
     * GET /rest/code-suggestion/1.0/suggestions/{repoId}/{prId}/file?path=...
     */
    @GET
    @Path("/suggestions/{repoId}/{prId}/file")
    public Response getSuggestionsForFile(@PathParam("repoId") int repoId,
                                           @PathParam("prId") long prId,
                                           @QueryParam("path") String filePath) {
        try {
            if (filePath == null || filePath.isEmpty()) {
                return errorResponse(Response.Status.BAD_REQUEST, "파일 경로가 필요합니다.");
            }

            List<CodeSuggestion> suggestions =
                    suggestionService.getSuggestionsForFile(prId, repoId, filePath);

            return Response.ok(gson.toJson(suggestions)).build();
        } catch (Exception e) {
            return errorResponse(Response.Status.INTERNAL_SERVER_ERROR,
                    "파일 제안 조회 실패: " + e.getMessage());
        }
    }

    /**
     * Update suggestion status (accept/reject/dismiss).
     *
     * PUT /rest/code-suggestion/1.0/suggestions/{suggestionId}/status
     */
    @PUT
    @Path("/suggestions/{suggestionId}/status")
    public Response updateSuggestionStatus(@PathParam("suggestionId") long suggestionId,
                                            String requestBody) {
        try {
            Map<String, String> body = gson.fromJson(requestBody, Map.class);
            String status = body.get("status");
            String resolvedBy = body.get("resolvedBy");

            if (status == null || status.isEmpty()) {
                return errorResponse(Response.Status.BAD_REQUEST, "status는 필수입니다.");
            }

            if (!isValidStatus(status)) {
                return errorResponse(Response.Status.BAD_REQUEST,
                        "유효하지 않은 status입니다. (ACCEPTED, REJECTED, DISMISSED 중 하나)");
            }

            CodeSuggestion updated = suggestionService.updateSuggestionStatus(
                    suggestionId, status.toUpperCase(), resolvedBy);

            return Response.ok(gson.toJson(updated)).build();
        } catch (IllegalArgumentException e) {
            return errorResponse(Response.Status.NOT_FOUND, e.getMessage());
        } catch (Exception e) {
            return errorResponse(Response.Status.INTERNAL_SERVER_ERROR,
                    "제안 상태 업데이트 실패: " + e.getMessage());
        }
    }

    /**
     * Get suggestion statistics for a pull request.
     *
     * GET /rest/code-suggestion/1.0/stats/{repoId}/{prId}
     */
    @GET
    @Path("/stats/{repoId}/{prId}")
    public Response getStats(@PathParam("repoId") int repoId,
                              @PathParam("prId") long prId) {
        try {
            SuggestionService.SuggestionStats stats = suggestionService.getStats(prId, repoId);
            return Response.ok(gson.toJson(stats)).build();
        } catch (Exception e) {
            return errorResponse(Response.Status.INTERNAL_SERVER_ERROR,
                    "통계 조회 실패: " + e.getMessage());
        }
    }

    /**
     * Delete all suggestions for a pull request (re-analyze).
     *
     * DELETE /rest/code-suggestion/1.0/suggestions/{repoId}/{prId}
     */
    @DELETE
    @Path("/suggestions/{repoId}/{prId}")
    public Response deleteSuggestions(@PathParam("repoId") int repoId,
                                      @PathParam("prId") long prId) {
        try {
            suggestionService.deleteSuggestions(prId, repoId);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "PR #" + prId + "의 제안이 모두 삭제되었습니다.");

            return Response.ok(gson.toJson(result)).build();
        } catch (Exception e) {
            return errorResponse(Response.Status.INTERNAL_SERVER_ERROR,
                    "제안 삭제 실패: " + e.getMessage());
        }
    }

    private boolean isValidStatus(String status) {
        String upper = status.toUpperCase();
        return "ACCEPTED".equals(upper) || "REJECTED".equals(upper) || "DISMISSED".equals(upper);
    }

    private Response errorResponse(Response.Status status, String message) {
        Map<String, Object> error = new HashMap<>();
        error.put("success", false);
        error.put("error", message);
        return Response.status(status).entity(gson.toJson(error)).build();
    }
}

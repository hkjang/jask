/**
 * Jask Code Suggestion - PR 코드 제안 프론트엔드
 */
(function ($) {
    'use strict';

    var REST_BASE = AJS.contextPath() + '/rest/code-suggestion/1.0';
    var container = null;
    var currentFilter = 'all';
    var allSuggestions = [];

    /**
     * Initialize the plugin when the page loads.
     */
    function init() {
        container = $('#jask-code-suggestions');
        if (!container.length) return;

        var prId = container.data('pr-id');
        var repoId = container.data('repo-id');

        if (!prId || !repoId) return;

        bindEvents();
        loadSuggestions(repoId, prId);
    }

    /**
     * Bind UI event handlers.
     */
    function bindEvents() {
        // Re-analyze button
        $(document).on('click', '#jask-reanalyze-btn', function () {
            var prId = container.data('pr-id');
            var repoId = container.data('repo-id');
            reanalyze(repoId, prId);
        });

        // Filter buttons
        $(document).on('click', '.jask-filter-btn', function () {
            var filter = $(this).data('filter');
            currentFilter = filter;
            $('.jask-filter-btn').removeClass('active');
            $(this).addClass('active');
            renderSuggestions(allSuggestions);
        });

        // Accept suggestion
        $(document).on('click', '.jask-accept-btn', function () {
            var id = $(this).data('id');
            updateSuggestionStatus(id, 'ACCEPTED');
        });

        // Reject suggestion
        $(document).on('click', '.jask-reject-btn', function () {
            var id = $(this).data('id');
            updateSuggestionStatus(id, 'REJECTED');
        });

        // Dismiss suggestion
        $(document).on('click', '.jask-dismiss-btn', function () {
            var id = $(this).data('id');
            updateSuggestionStatus(id, 'DISMISSED');
        });

        // Toggle code diff
        $(document).on('click', '.jask-toggle-code', function () {
            var $codeBlock = $(this).closest('.jask-suggestion-item').find('.jask-code-diff');
            $codeBlock.slideToggle(200);
            $(this).toggleClass('expanded');
        });
    }

    /**
     * Load suggestions from REST API.
     */
    function loadSuggestions(repoId, prId) {
        showLoading(true);

        $.ajax({
            url: REST_BASE + '/suggestions/' + repoId + '/' + prId,
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                showLoading(false);
                allSuggestions = data.suggestions || [];

                if (allSuggestions.length === 0) {
                    showEmpty(true);
                    return;
                }

                updateSummary(data.stats);
                renderSuggestions(allSuggestions);
                $('#jask-suggestions-summary').show();
                $('#jask-suggestions-list').show();
                $('#jask-suggestions-badge').text(allSuggestions.length).show();
            },
            error: function (xhr) {
                showLoading(false);
                showError('제안 목록을 불러오지 못했습니다: ' + (xhr.responseJSON ? xhr.responseJSON.error : xhr.statusText));
            }
        });
    }

    /**
     * Trigger re-analysis.
     */
    function reanalyze(repoId, prId) {
        var $btn = $('#jask-reanalyze-btn');
        $btn.prop('disabled', true).text('분석 중...');

        // Delete old suggestions first
        $.ajax({
            url: REST_BASE + '/suggestions/' + repoId + '/' + prId,
            type: 'DELETE',
            success: function () {
                AJS.flag({
                    type: 'info',
                    title: 'AI 코드 분석',
                    body: '코드 분석이 요청되었습니다. 잠시 후 결과가 업데이트됩니다.',
                    close: 'auto'
                });

                // Poll for results
                setTimeout(function () {
                    loadSuggestions(repoId, prId);
                    $btn.prop('disabled', false).html(
                        '<span class="aui-icon aui-icon-small aui-iconfont-refresh"></span> 다시 분석'
                    );
                }, 5000);
            },
            error: function () {
                $btn.prop('disabled', false).html(
                    '<span class="aui-icon aui-icon-small aui-iconfont-refresh"></span> 다시 분석'
                );
                AJS.flag({
                    type: 'error',
                    title: '오류',
                    body: '재분석 요청에 실패했습니다.',
                    close: 'auto'
                });
            }
        });
    }

    /**
     * Update suggestion status via REST API.
     */
    function updateSuggestionStatus(suggestionId, status) {
        $.ajax({
            url: REST_BASE + '/suggestions/' + suggestionId + '/status',
            type: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({
                status: status,
                resolvedBy: AJS.params.remoteUser || 'unknown'
            }),
            success: function (data) {
                // Update local data
                for (var i = 0; i < allSuggestions.length; i++) {
                    if (allSuggestions[i].id === suggestionId) {
                        allSuggestions[i].status = status;
                        break;
                    }
                }

                // Update UI
                var $item = $('.jask-suggestion-item[data-id="' + suggestionId + '"]');
                $item.addClass('jask-status-' + status.toLowerCase());
                $item.find('.jask-status-badge').text(getStatusLabel(status));

                var statusMsg = {
                    'ACCEPTED': '제안을 적용했습니다.',
                    'REJECTED': '제안을 거부했습니다.',
                    'DISMISSED': '제안을 무시했습니다.'
                };

                AJS.flag({
                    type: status === 'ACCEPTED' ? 'success' : 'info',
                    title: '코드 제안',
                    body: statusMsg[status] || '상태가 업데이트되었습니다.',
                    close: 'auto'
                });
            },
            error: function () {
                AJS.flag({
                    type: 'error',
                    title: '오류',
                    body: '제안 상태 업데이트에 실패했습니다.',
                    close: 'auto'
                });
            }
        });
    }

    /**
     * Render suggestions list.
     */
    function renderSuggestions(suggestions) {
        var $list = $('#jask-suggestions-list');
        $list.empty();

        var filtered = filterSuggestions(suggestions);

        if (filtered.length === 0) {
            $list.html('<div class="jask-no-results">필터 조건에 맞는 제안이 없습니다.</div>');
            return;
        }

        filtered.forEach(function (suggestion) {
            $list.append(buildSuggestionCard(suggestion));
        });
    }

    /**
     * Filter suggestions by current filter.
     */
    function filterSuggestions(suggestions) {
        if (currentFilter === 'all') return suggestions;

        return suggestions.filter(function (s) {
            if (currentFilter === 'PENDING') return s.status === 'PENDING';
            return s.severity === currentFilter;
        });
    }

    /**
     * Build a suggestion card HTML element.
     */
    function buildSuggestionCard(suggestion) {
        var severityClass = 'jask-severity-' + (suggestion.severity || 'info').toLowerCase();
        var statusClass = 'jask-status-' + (suggestion.status || 'pending').toLowerCase();

        var html = '<div class="jask-suggestion-item ' + severityClass + ' ' + statusClass + '" data-id="' + suggestion.id + '">';

        // Header
        html += '<div class="jask-suggestion-header">';
        html += '<span class="jask-severity-badge ' + severityClass + '">' + getSeverityLabel(suggestion.severity) + '</span>';
        html += '<span class="jask-category-badge">' + getCategoryLabel(suggestion.category) + '</span>';
        html += '<span class="jask-file-path">' + escapeHtml(suggestion.filePath || '') + '</span>';
        if (suggestion.startLine > 0) {
            html += '<span class="jask-line-range">L' + suggestion.startLine;
            if (suggestion.endLine > suggestion.startLine) {
                html += '-' + suggestion.endLine;
            }
            html += '</span>';
        }
        html += '<span class="jask-confidence">' + Math.round((suggestion.confidence || 0) * 100) + '% 확신</span>';
        html += '<span class="jask-status-badge">' + getStatusLabel(suggestion.status) + '</span>';
        html += '</div>';

        // Explanation
        html += '<div class="jask-suggestion-body">';
        html += '<p class="jask-explanation">' + escapeHtml(suggestion.explanation || '') + '</p>';

        // Code diff toggle
        if (suggestion.originalCode || suggestion.suggestedCode) {
            html += '<button class="aui-button aui-button-link jask-toggle-code">코드 변경 보기</button>';
            html += '<div class="jask-code-diff" style="display:none;">';

            if (suggestion.originalCode) {
                html += '<div class="jask-code-block jask-code-original">';
                html += '<div class="jask-code-label">기존 코드</div>';
                html += '<pre><code>' + escapeHtml(suggestion.originalCode) + '</code></pre>';
                html += '</div>';
            }

            if (suggestion.suggestedCode) {
                html += '<div class="jask-code-block jask-code-suggested">';
                html += '<div class="jask-code-label">개선 코드</div>';
                html += '<pre><code>' + escapeHtml(suggestion.suggestedCode) + '</code></pre>';
                html += '</div>';
            }

            html += '</div>';
        }

        // Actions
        if (suggestion.status === 'PENDING') {
            html += '<div class="jask-suggestion-actions">';
            html += '<button class="aui-button aui-button-primary jask-accept-btn" data-id="' + suggestion.id + '">적용</button>';
            html += '<button class="aui-button jask-reject-btn" data-id="' + suggestion.id + '">거부</button>';
            html += '<button class="aui-button aui-button-subtle jask-dismiss-btn" data-id="' + suggestion.id + '">무시</button>';
            html += '</div>';
        }

        html += '</div>';
        html += '</div>';

        return html;
    }

    /**
     * Update summary panel.
     */
    function updateSummary(stats) {
        if (!stats) return;

        $('#jask-critical-count').text(stats.critical || 0);
        $('#jask-warning-count').text(stats.warning || 0);
        $('#jask-info-count').text((stats.total || 0) - (stats.critical || 0) - (stats.warning || 0));
        $('#jask-hint-count').text(0);

        // Calculate quality score
        var score = 100 - (stats.critical || 0) * 20 - (stats.warning || 0) * 5;
        score = Math.max(0, Math.min(100, score));
        var $scoreEl = $('#jask-quality-score');
        $scoreEl.text(score);

        if (score >= 80) {
            $scoreEl.addClass('jask-score-good');
        } else if (score >= 50) {
            $scoreEl.addClass('jask-score-warning');
        } else {
            $scoreEl.addClass('jask-score-critical');
        }
    }

    // --- Helper Functions ---

    function getSeverityLabel(severity) {
        var labels = {
            'CRITICAL': '심각',
            'WARNING': '경고',
            'INFO': '정보',
            'HINT': '참고'
        };
        return labels[severity] || severity;
    }

    function getCategoryLabel(category) {
        var labels = {
            'SECURITY': '보안',
            'PERFORMANCE': '성능',
            'BUG_RISK': '버그 위험',
            'CODE_STYLE': '코드 스타일',
            'BEST_PRACTICE': '모범 사례',
            'DUPLICATION': '중복 코드',
            'COMPLEXITY': '복잡도',
            'ERROR_HANDLING': '에러 처리'
        };
        return labels[category] || category;
    }

    function getStatusLabel(status) {
        var labels = {
            'PENDING': '미처리',
            'ACCEPTED': '적용됨',
            'REJECTED': '거부됨',
            'DISMISSED': '무시됨'
        };
        return labels[status] || status;
    }

    function showLoading(show) {
        $('#jask-suggestions-loading').toggle(show);
    }

    function showEmpty(show) {
        $('#jask-suggestions-empty').toggle(show);
    }

    function showError(message) {
        $('#jask-error-message').text(message);
        $('#jask-suggestions-error').show();
    }

    function escapeHtml(text) {
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    // Initialize on page ready
    $(document).ready(function () {
        // Delay init to ensure Bitbucket PR page is fully loaded
        setTimeout(init, 500);
    });

})(AJS.$);

package com.jask.bitbucket.servlet;

import com.atlassian.plugin.spring.scanner.annotation.imports.ComponentImport;
import com.atlassian.sal.api.auth.LoginUriProvider;
import com.atlassian.sal.api.user.UserManager;
import com.atlassian.sal.api.user.UserProfile;
import com.atlassian.soy.renderer.SoyException;
import com.atlassian.soy.renderer.SoyTemplateRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.inject.Named;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;

/**
 * Servlet for the admin configuration page.
 */
@Named("adminConfigServlet")
public class AdminConfigServlet extends HttpServlet {

    private static final Logger log = LoggerFactory.getLogger(AdminConfigServlet.class);

    private final UserManager userManager;
    private final LoginUriProvider loginUriProvider;
    private final SoyTemplateRenderer soyRenderer;

    @Inject
    public AdminConfigServlet(@ComponentImport UserManager userManager,
                               @ComponentImport LoginUriProvider loginUriProvider,
                               @ComponentImport SoyTemplateRenderer soyRenderer) {
        this.userManager = userManager;
        this.loginUriProvider = loginUriProvider;
        this.soyRenderer = soyRenderer;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        // Check authentication
        UserProfile user = userManager.getRemoteUser(req);
        if (user == null) {
            redirectToLogin(req, resp);
            return;
        }

        // Check admin permission
        if (!userManager.isSystemAdmin(user.getUserKey())) {
            resp.sendError(HttpServletResponse.SC_FORBIDDEN,
                    "시스템 관리자 권한이 필요합니다.");
            return;
        }

        // Render admin page
        resp.setContentType("text/html;charset=UTF-8");

        try {
            Map<String, Object> context = new HashMap<>();
            context.put("currentUser", user.getUsername());

            soyRenderer.render(resp.getWriter(),
                    "com.jask.bitbucket.code-suggestion-addon:admin-resources",
                    "jask.admin.configPage",
                    context);
        } catch (SoyException e) {
            log.error("관리자 설정 페이지 렌더링 실패: {}", e.getMessage(), e);
            // Fallback to raw HTML
            renderFallbackHtml(resp);
        }
    }

    private void redirectToLogin(HttpServletRequest req, HttpServletResponse resp)
            throws IOException {
        URI currentUri = URI.create(req.getRequestURL().toString());
        resp.sendRedirect(loginUriProvider.getLoginUri(currentUri).toASCIIString());
    }

    private void renderFallbackHtml(HttpServletResponse resp) throws IOException {
        resp.getWriter().write(buildAdminHtml());
    }

    private String buildAdminHtml() {
        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>AI 코드 제안 설정 - Jask</title>
                    <style>
                        * { box-sizing: border-box; margin: 0; padding: 0; }
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f5f7; color: #172b4d; }
                        .admin-container { max-width: 800px; margin: 30px auto; padding: 0 20px; }
                        .admin-header { margin-bottom: 30px; }
                        .admin-header h1 { font-size: 24px; margin-bottom: 8px; }
                        .admin-header p { color: #6b778c; }
                        .admin-section { background: #fff; border-radius: 8px; border: 1px solid #dfe1e6; margin-bottom: 20px; overflow: hidden; }
                        .admin-section-header { padding: 16px 20px; background: #fafbfc; border-bottom: 1px solid #dfe1e6; }
                        .admin-section-header h2 { font-size: 16px; font-weight: 600; }
                        .admin-section-body { padding: 20px; }
                        .form-group { margin-bottom: 16px; }
                        .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #505f79; }
                        .form-group input, .form-group select { width: 100%; padding: 8px 12px; border: 1px solid #dfe1e6; border-radius: 4px; font-size: 14px; }
                        .form-group input:focus, .form-group select:focus { border-color: #0052cc; outline: none; box-shadow: 0 0 0 2px rgba(0,82,204,0.2); }
                        .form-group .help-text { font-size: 12px; color: #6b778c; margin-top: 4px; }
                        .form-group-inline { display: flex; align-items: center; gap: 10px; }
                        .toggle-switch { position: relative; width: 48px; height: 24px; }
                        .toggle-switch input { opacity: 0; width: 0; height: 0; }
                        .toggle-slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #dfe1e6; border-radius: 24px; cursor: pointer; transition: 0.3s; }
                        .toggle-slider:before { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; }
                        .toggle-switch input:checked + .toggle-slider { background: #0052cc; }
                        .toggle-switch input:checked + .toggle-slider:before { transform: translateX(24px); }
                        .btn-group { display: flex; gap: 10px; margin-top: 24px; }
                        .btn { padding: 10px 20px; border: none; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.15s; }
                        .btn-primary { background: #0052cc; color: #fff; }
                        .btn-primary:hover { background: #0747a6; }
                        .btn-secondary { background: #f4f5f7; color: #172b4d; border: 1px solid #dfe1e6; }
                        .btn-secondary:hover { background: #ebecf0; }
                        .btn-test { background: #36b37e; color: #fff; }
                        .btn-test:hover { background: #2d9e6f; }
                        .status-indicator { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
                        .status-connected { background: #36b37e; }
                        .status-disconnected { background: #de350b; }
                        .toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 4px; color: #fff; font-size: 14px; z-index: 9999; display: none; }
                        .toast-success { background: #36b37e; }
                        .toast-error { background: #de350b; }
                    </style>
                </head>
                <body>
                    <div class="admin-container">
                        <div class="admin-header">
                            <h1>AI 코드 제안 설정</h1>
                            <p>Pull Request에서 AI 코드 리뷰 및 제안 기능을 설정합니다.</p>
                        </div>

                        <!-- LLM 설정 -->
                        <div class="admin-section">
                            <div class="admin-section-header">
                                <h2>LLM 연결 설정</h2>
                            </div>
                            <div class="admin-section-body">
                                <div class="form-group">
                                    <label for="llmEndpoint">API 엔드포인트</label>
                                    <input type="url" id="llmEndpoint" placeholder="http://localhost:11434/api/chat">
                                    <div class="help-text">Ollama: /api/chat, vLLM/OpenAI: /v1/chat/completions</div>
                                </div>
                                <div class="form-group">
                                    <label for="llmApiKey">API 키 (선택사항)</label>
                                    <input type="password" id="llmApiKey" placeholder="OpenAI/vLLM API 키">
                                    <div class="help-text">Ollama는 API 키가 필요 없습니다</div>
                                </div>
                                <div class="form-group">
                                    <label for="llmModel">모델명</label>
                                    <input type="text" id="llmModel" placeholder="codellama:13b">
                                </div>
                                <div style="display: flex; gap: 16px;">
                                    <div class="form-group" style="flex: 1;">
                                        <label for="llmTemperature">Temperature</label>
                                        <input type="number" id="llmTemperature" step="0.1" min="0" max="2" placeholder="0.1">
                                    </div>
                                    <div class="form-group" style="flex: 1;">
                                        <label for="llmMaxTokens">최대 토큰 수</label>
                                        <input type="number" id="llmMaxTokens" min="256" max="32768" placeholder="4096">
                                    </div>
                                </div>
                                <button id="testConnectionBtn" class="btn btn-test" onclick="testConnection()">
                                    연결 테스트
                                </button>
                                <span id="connectionStatus" style="margin-left: 10px;"></span>
                            </div>
                        </div>

                        <!-- 분석 설정 -->
                        <div class="admin-section">
                            <div class="admin-section-header">
                                <h2>분석 설정</h2>
                            </div>
                            <div class="admin-section-body">
                                <div class="form-group form-group-inline">
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="autoAnalysisEnabled" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                    <label for="autoAnalysisEnabled" style="margin-bottom: 0;">PR 생성/업데이트 시 자동 분석</label>
                                </div>
                                <div class="form-group form-group-inline" style="margin-top: 12px;">
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="mergeCheckEnabled">
                                        <span class="toggle-slider"></span>
                                    </label>
                                    <label for="mergeCheckEnabled" style="margin-bottom: 0;">미해결 CRITICAL 이슈 시 머지 차단</label>
                                </div>
                                <div class="form-group" style="margin-top: 16px;">
                                    <label for="mergeCheckMaxCritical">허용 CRITICAL 이슈 수</label>
                                    <input type="number" id="mergeCheckMaxCritical" min="0" max="100" placeholder="0">
                                    <div class="help-text">이 수 이하의 CRITICAL 이슈는 머지를 허용합니다 (0 = CRITICAL 이슈 없어야 함)</div>
                                </div>
                                <div class="form-group">
                                    <label for="minConfidenceThreshold">최소 확신도 (0.0 ~ 1.0)</label>
                                    <input type="number" id="minConfidenceThreshold" step="0.05" min="0" max="1" placeholder="0.7">
                                    <div class="help-text">이 값 미만의 제안은 필터링됩니다</div>
                                </div>
                            </div>
                        </div>

                        <!-- 파일 설정 -->
                        <div class="admin-section">
                            <div class="admin-section-header">
                                <h2>파일 설정</h2>
                            </div>
                            <div class="admin-section-body">
                                <div class="form-group">
                                    <label for="excludedFilePatterns">제외 파일 패턴 (쉼표 구분)</label>
                                    <input type="text" id="excludedFilePatterns" placeholder="*.min.js,*.min.css,*.map,*.lock">
                                </div>
                                <div class="form-group">
                                    <label for="supportedLanguages">지원 언어 (쉼표 구분)</label>
                                    <input type="text" id="supportedLanguages" placeholder="java,javascript,typescript,python,go">
                                </div>
                                <div style="display: flex; gap: 16px;">
                                    <div class="form-group" style="flex: 1;">
                                        <label for="maxFilesPerAnalysis">분석당 최대 파일 수</label>
                                        <input type="number" id="maxFilesPerAnalysis" min="1" max="200" placeholder="50">
                                    </div>
                                    <div class="form-group" style="flex: 1;">
                                        <label for="maxFileSizeKb">최대 파일 크기 (KB)</label>
                                        <input type="number" id="maxFileSizeKb" min="1" max="10000" placeholder="500">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="btn-group">
                            <button class="btn btn-primary" onclick="saveSettings()">설정 저장</button>
                            <button class="btn btn-secondary" onclick="loadSettings()">초기화</button>
                        </div>
                    </div>

                    <div id="toast" class="toast"></div>

                    <script>
                        var REST_BASE = (window.AJS ? AJS.contextPath() : '') + '/rest/code-suggestion/1.0/admin';

                        function loadSettings() {
                            fetch(REST_BASE + '/settings')
                                .then(function(r) { return r.json(); })
                                .then(function(data) {
                                    document.getElementById('llmEndpoint').value = data.llmEndpoint || '';
                                    document.getElementById('llmModel').value = data.llmModel || '';
                                    document.getElementById('llmTemperature').value = data.llmTemperature || 0.1;
                                    document.getElementById('llmMaxTokens').value = data.llmMaxTokens || 4096;
                                    document.getElementById('autoAnalysisEnabled').checked = data.autoAnalysisEnabled !== false;
                                    document.getElementById('mergeCheckEnabled').checked = data.mergeCheckEnabled === true;
                                    document.getElementById('mergeCheckMaxCritical').value = data.mergeCheckMaxCritical || 0;
                                    document.getElementById('minConfidenceThreshold').value = data.minConfidenceThreshold || 0.7;
                                    document.getElementById('excludedFilePatterns').value = data.excludedFilePatterns || '';
                                    document.getElementById('supportedLanguages').value = data.supportedLanguages || '';
                                    document.getElementById('maxFilesPerAnalysis').value = data.maxFilesPerAnalysis || 50;
                                    document.getElementById('maxFileSizeKb').value = data.maxFileSizeKb || 500;
                                })
                                .catch(function(err) {
                                    showToast('설정을 불러오지 못했습니다: ' + err.message, 'error');
                                });
                        }

                        function saveSettings() {
                            var settings = {
                                llmEndpoint: document.getElementById('llmEndpoint').value,
                                llmApiKey: document.getElementById('llmApiKey').value,
                                llmModel: document.getElementById('llmModel').value,
                                llmTemperature: parseFloat(document.getElementById('llmTemperature').value),
                                llmMaxTokens: parseInt(document.getElementById('llmMaxTokens').value),
                                autoAnalysisEnabled: document.getElementById('autoAnalysisEnabled').checked,
                                mergeCheckEnabled: document.getElementById('mergeCheckEnabled').checked,
                                mergeCheckMaxCritical: parseInt(document.getElementById('mergeCheckMaxCritical').value),
                                minConfidenceThreshold: parseFloat(document.getElementById('minConfidenceThreshold').value),
                                excludedFilePatterns: document.getElementById('excludedFilePatterns').value,
                                supportedLanguages: document.getElementById('supportedLanguages').value,
                                maxFilesPerAnalysis: parseInt(document.getElementById('maxFilesPerAnalysis').value),
                                maxFileSizeKb: parseInt(document.getElementById('maxFileSizeKb').value)
                            };

                            fetch(REST_BASE + '/settings', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(settings)
                            })
                            .then(function(r) { return r.json(); })
                            .then(function(data) {
                                if (data.success) {
                                    showToast('설정이 저장되었습니다.', 'success');
                                } else {
                                    showToast('저장 실패: ' + data.error, 'error');
                                }
                            })
                            .catch(function(err) {
                                showToast('저장 실패: ' + err.message, 'error');
                            });
                        }

                        function testConnection() {
                            var btn = document.getElementById('testConnectionBtn');
                            var status = document.getElementById('connectionStatus');
                            btn.disabled = true;
                            btn.textContent = '테스트 중...';
                            status.textContent = '';

                            // Save endpoint first, then test
                            var endpoint = document.getElementById('llmEndpoint').value;
                            fetch(REST_BASE + '/settings', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ llmEndpoint: endpoint })
                            })
                            .then(function() {
                                return fetch(REST_BASE + '/test-connection', { method: 'POST' });
                            })
                            .then(function(r) { return r.json(); })
                            .then(function(data) {
                                btn.disabled = false;
                                btn.textContent = '연결 테스트';

                                if (data.success) {
                                    status.innerHTML = '<span class="status-indicator status-connected"></span>연결 성공 (' + data.model + ')';
                                    showToast('LLM 서비스 연결 성공!', 'success');
                                } else {
                                    status.innerHTML = '<span class="status-indicator status-disconnected"></span>연결 실패';
                                    showToast(data.message, 'error');
                                }
                            })
                            .catch(function(err) {
                                btn.disabled = false;
                                btn.textContent = '연결 테스트';
                                status.innerHTML = '<span class="status-indicator status-disconnected"></span>연결 오류';
                                showToast('연결 테스트 실패: ' + err.message, 'error');
                            });
                        }

                        function showToast(message, type) {
                            var toast = document.getElementById('toast');
                            toast.textContent = message;
                            toast.className = 'toast toast-' + type;
                            toast.style.display = 'block';
                            setTimeout(function() {
                                toast.style.display = 'none';
                            }, 4000);
                        }

                        // Load settings on page load
                        document.addEventListener('DOMContentLoaded', loadSettings);
                    </script>
                </body>
                </html>
                """;
    }
}

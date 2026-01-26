const API_BASE_URL = '/api';

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }

  private async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      // 401 Unauthorized 응답 시 토큰 만료로 간주하고 로그인 페이지로 이동
      if (response.status === 401) {
        this.clearToken();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  // Generic methods
  public async get<T>(endpoint: string) {
      return this.request<T>(endpoint, { method: 'GET' });
  }

  public async post<T>(endpoint: string, body?: any) {
      return this.request<T>(endpoint, { method: 'POST', body });
  }

  public async put<T>(endpoint: string, body?: any) {
      return this.request<T>(endpoint, { method: 'PUT', body });
  }

  public async delete<T>(endpoint: string) {
      return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<{ accessToken: string; user: any }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    this.setToken(data.accessToken);
    return data;
  }

  async register(email: string, password: string, name: string) {
    const data = await this.request<{ accessToken: string; user: any }>('/auth/register', {
      method: 'POST',
      body: { email, password, name },
    });
    this.setToken(data.accessToken);
    return data;
  }

  // Profile
  async getProfile() {
    return this.request<any>('/auth/profile');
  }

  async updateProfile(data: { name?: string; department?: string; customInstructions?: string }) {
    return this.request('/auth/profile', { method: 'PUT', body: data });
  }

  // DataSources
  async getDataSources() {
    return this.request<any[]>('/datasources');
  }

  async getDataSourcesOverview() {
    return this.request<any>('/datasources/overview');
  }

  async getConnectionTemplates() {
    return this.request<any[]>('/datasources/templates');
  }

  async createDataSource(data: any) {
    return this.request('/datasources', { method: 'POST', body: data });
  }

  async testConnection(data: any) {
    return this.request('/datasources/test-connection', { method: 'POST', body: data });
  }

  async updateDataSource(id: string, data: any) {
    return this.request(`/datasources/${id}`, { method: 'PUT', body: data });
  }

  async deleteDataSource(id: string) {
    return this.request(`/datasources/${id}`, { method: 'DELETE' });
  }

  async getDataSourceHealth(id: string) {
    return this.request<any>(`/datasources/${id}/health`);
  }

  async getDataSourceStatistics(id: string) {
    return this.request<any>(`/datasources/${id}/statistics`);
  }

  async refreshDataSourceConnection(id: string) {
    return this.request<any>(`/datasources/${id}/refresh-connection`, { method: 'POST' });
  }

  // Data Source Access Management
  async getDataSourceUsers(dataSourceId: string) {
    return this.request<any[]>(`/datasources/${dataSourceId}/users`);
  }

  async grantDataSourceAccess(dataSourceId: string, data: {
    userId: string;
    role: 'VIEWER' | 'EDITOR' | 'ADMIN';
    note?: string;
    expiresAt?: string;
  }) {
    return this.request(`/datasources/${dataSourceId}/grant`, { method: 'POST', body: data });
  }

  async updateDataSourceAccess(dataSourceId: string, userId: string, role: 'VIEWER' | 'EDITOR' | 'ADMIN') {
    return this.request(`/datasources/${dataSourceId}/access/${userId}`, { method: 'PUT', body: { role } });
  }

  async revokeDataSourceAccess(dataSourceId: string, userId: string) {
    return this.request(`/datasources/${dataSourceId}/revoke/${userId}`, { method: 'DELETE' });
  }

  async bulkGrantDataSourceAccess(dataSourceId: string, userIds: string[], role: 'VIEWER' | 'EDITOR' | 'ADMIN') {
    return this.request(`/datasources/${dataSourceId}/bulk-grant`, { method: 'POST', body: { userIds, role } });
  }

  async bulkRevokeDataSourceAccess(dataSourceId: string, userIds: string[]) {
    return this.request(`/datasources/${dataSourceId}/bulk-revoke`, { method: 'POST', body: { userIds } });
  }


  async syncMetadata(dataSourceId: string) {
    return this.request(`/metadata/sync/${dataSourceId}`, { method: 'POST' });
  }

  async translateMetadata(dataSourceId: string) {
    // Determine backend URL (assuming localhost:4000 for dev environments)
    // Ideally this should come from env or config. 
    // Since we are fixing a dev-mode proxy timeout, we use the direct backend URL.
    const baseUrl = '/api';
    const token = this.getToken();
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${baseUrl}/metadata/translate/${dataSourceId}`, { 
      method: 'POST',
      headers
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Translation Failed: ${response.status}`);
    }
    return response.json();
  }

  // NL2SQL
  async generateQuery(dataSourceId: string, question: string, autoExecute = false, threadId?: string) {
    return this.request('/nl2sql/generate', {
      method: 'POST',
      body: { dataSourceId, question, autoExecute, threadId },
    });
  }

  async simulateQuery(dataSourceId: string, question: string) {
    return this.request<any>('/nl2sql/simulate/' + dataSourceId, {
      method: 'POST',
      body: { question },
    });
  }

  async *generateQueryStream(dataSourceId: string, question: string, autoExecute = false, threadId?: string): AsyncGenerator<any> {
    const token = this.getToken();
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Use direct URL to bypass Next.js proxy buffering
    const response = await fetch(`/api/nl2sql/generate/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ dataSourceId, question, autoExecute, threadId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stream Error: ${response.status} - ${errorText}`);
    }

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            yield data;
          } catch (e) {
            console.error('JSON Parse Error', e);
          }
        }
      }
    }
  }

  async executeQuery(queryId: string, sql?: string) {
    return this.request(`/nl2sql/execute/${queryId}`, {
      method: 'POST',
      body: sql ? { sql } : {},
    });
  }

  async previewQuery(queryId: string, sql?: string) {
    return this.request(`/nl2sql/preview/${queryId}`, {
      method: 'POST',
      body: sql ? { sql } : {},
    });
  }

  async submitFeedback(queryId: string, feedback: 'POSITIVE' | 'NEGATIVE', note?: string) {
    return this.request(`/nl2sql/feedback/${queryId}`, {
      method: 'POST',
      body: { feedback, note },
    });
  }

  async getRecommendedQuestions(dataSourceId: string, forceRegenerate?: boolean): Promise<string[]> {
    return this.request<string[]>(`/nl2sql/recommend/${dataSourceId}`, {
      method: 'POST',
      body: { forceRegenerate },
    });
  }

  // Query History
  async getQueryHistory(params?: { page?: number; limit?: number; dataSourceId?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.dataSourceId) query.set('dataSourceId', params.dataSourceId);
    return this.request(`/query/history?${query}`);
  }

  async getQueryById(id: string) {
    return this.request(`/query/history/${id}`);
  }

  // ===========================================
  // 즐겨찾기
  // ===========================================
  
  async getFavorites(options?: { 
    folderId?: string; 
    tag?: string; 
    dataSourceId?: string;
    sortBy?: 'createdAt' | 'useCount' | 'name' | 'displayOrder';
    sortOrder?: 'asc' | 'desc';
  }) {
    const query = new URLSearchParams();
    if (options?.folderId) query.set('folderId', options.folderId);
    if (options?.tag) query.set('tag', options.tag);
    if (options?.dataSourceId) query.set('dataSourceId', options.dataSourceId);
    if (options?.sortBy) query.set('sortBy', options.sortBy);
    if (options?.sortOrder) query.set('sortOrder', options.sortOrder);
    const queryString = query.toString();
    return this.request(`/query/favorites${queryString ? `?${queryString}` : ''}`);
  }

  async addFavorite(data: { 
    name: string; 
    naturalQuery: string; 
    sqlQuery: string;
    dataSourceId?: string;
    folderId?: string;
    tags?: string[];
    description?: string;
  }) {
    return this.request('/query/favorites', { method: 'POST', body: data });
  }

  async updateFavorite(id: string, data: { 
    name?: string; 
    folderId?: string | null;
    tags?: string[];
    description?: string;
    displayOrder?: number;
  }) {
    return this.request(`/query/favorites/${id}`, { method: 'PUT', body: data });
  }

  async removeFavorite(id: string) {
    return this.request(`/query/favorites/${id}`, { method: 'DELETE' });
  }

  async useFavorite(id: string) {
    return this.request(`/query/favorites/${id}/use`, { method: 'PATCH' });
  }

  async getFavoriteStats() {
    return this.request('/query/favorites/stats');
  }

  async reorderFavorites(orderedIds: string[]) {
    return this.request('/query/favorites/reorder', { method: 'PUT', body: { orderedIds } });
  }

  // 즐겨찾기 폴더
  async getFavoriteFolders() {
    return this.request('/query/favorites/folders');
  }

  async createFavoriteFolder(data: { name: string; color?: string; icon?: string }) {
    return this.request('/query/favorites/folders', { method: 'POST', body: data });
  }

  async updateFavoriteFolder(id: string, data: { name?: string; color?: string; icon?: string; displayOrder?: number }) {
    return this.request(`/query/favorites/folders/${id}`, { method: 'PUT', body: data });
  }

  async deleteFavoriteFolder(id: string) {
    return this.request(`/query/favorites/folders/${id}`, { method: 'DELETE' });
  }

  async getStats() {
    return this.request('/query/stats');
  }


  // Admin
  async getDashboard() {
    return this.request('/admin/dashboard');
  }

  async getLLMProviders() {
    return this.request('/admin/llm-providers');
  }

  async getUsers(page = 1, limit = 20) {
    return this.request(`/admin/users?page=${page}&limit=${limit}`);
  }

  async testLLMProvider(data: any) {
    return this.request('/admin/llm-providers/test', { method: 'POST', body: data });
  }

  // Sample Queries
  async getSampleQueries(dataSourceId?: string) {
    const query = dataSourceId ? `?dataSourceId=${dataSourceId}` : '';
    return this.request(`/admin/sample-queries${query}`);
  }

  async createSampleQuery(data: any) {
    return this.request('/admin/sample-queries', { method: 'POST', body: data });
  }

  async deleteSampleQuery(id: string) {
    return this.request(`/admin/sample-queries/${id}`, { method: 'DELETE' });
  }

  async updateSampleQuery(id: string, data: any) {
    return this.request(`/admin/sample-queries/${id}`, { method: 'PUT', body: data });
  }

  // Prompt Templates
  async getPromptTemplates() {
    return this.request<any[]>('/admin/prompt-templates');
  }

  async createPromptTemplate(data: any) {
    return this.request('/admin/prompt-templates', { method: 'POST', body: data });
  }

  async updatePromptTemplate(id: string, data: any) {
    return this.request(`/admin/prompt-templates/${id}`, { method: 'PUT', body: data });
  }

  async deletePromptTemplate(id: string) {
    return this.request(`/admin/prompt-templates/${id}`, { method: 'DELETE' });
  }

  // Policies (Governance)
  async getPolicies() {
    return this.request<any[]>('/admin/policies');
  }

  async createPolicy(data: any) {
    return this.request('/admin/policies', { method: 'POST', body: data });
  }

  async updatePolicy(id: string, data: any) {
    return this.request(`/admin/policies/${id}`, { method: 'PUT', body: data });
  }

  async deletePolicy(id: string) {
    return this.request(`/admin/policies/${id}`, { method: 'DELETE' });
  }

  // Recommended Questions Management
  async getAdminRecommendedQuestions(dataSourceId?: string) {
    const query = dataSourceId ? `?dataSourceId=${dataSourceId}` : '';
    return this.request<any[]>(`/admin/recommended-questions${query}`);
  }

  async createAdminRecommendedQuestion(data: {
    dataSourceId: string;
    question: string;
    category?: string;
    tags?: string[];
    description?: string;
  }) {
    return this.request('/admin/recommended-questions', { method: 'POST', body: data });
  }

  async updateAdminRecommendedQuestion(id: string, data: any) {
    return this.request(`/admin/recommended-questions/${id}`, { method: 'PUT', body: data });
  }

  async deleteAdminRecommendedQuestion(id: string) {
    return this.request(`/admin/recommended-questions/${id}`, { method: 'DELETE' });
  }

  async toggleAdminRecommendedQuestion(id: string) {
    return this.request(`/admin/recommended-questions/${id}/toggle`, { method: 'PUT' });
  }

  async generateAIRecommendedQuestions(dataSourceId: string, count?: number) {
    return this.request<{ generated: number; questions: any[] }>(
      '/admin/recommended-questions/generate',
      { method: 'POST', body: { dataSourceId, count } }
    );
  }


  // Evolution
  async getEvolutionCandidates(): Promise<any[]> {
    return this.request('/evolution/candidates');
  }

  async handleEvolutionCandidate(id: string, action: 'approve' | 'reject') {
    return this.request(`/evolution/candidates/${id}/${action}`, { method: 'POST' });
  }

  async getEvolutionStats(): Promise<any> {
    return this.request('/evolution/stats');
  }

  // Evolution - Policy Adjustment
  async getPolicyLogs() {
    return this.request<any[]>('/evolution/policy/logs');
  }

  async revertPolicyLog(id: string) {
    return this.request(`/evolution/policy/log/${id}/revert`, { method: 'POST' });
  }

  async getPolicyMetrics() {
    return this.request<Record<string, number>>('/evolution/policy/metrics');
  }

  async createPolicyTrigger(data: any) {
    return this.request('/evolution/policy/trigger', { method: 'POST', body: data });
  }

  async updatePolicyTrigger(id: string, data: any) {
    return this.request(`/evolution/policy/trigger/${id}`, { method: 'PATCH', body: data });
  }

  async createPolicyRule(data: any) {
    return this.request('/evolution/policy/rule', { method: 'POST', body: data });
  }

  async getPolicyRules() {
    return this.request<any[]>('/evolution/policy/rules');
  }

  async togglePolicyRule(id: string, isActive: boolean) {
    return this.request(`/evolution/policy/rule/${id}/toggle`, { method: 'POST', body: { id, isActive } });
  }

  async runPolicyCheck() {
    return this.request('/evolution/policy/run-check', { method: 'POST' });
  }

  // Metadata - Extended
  async getSchemaContext(dataSourceId: string) {
    return this.request<{ context: string }>(`/metadata/schema/${dataSourceId}`);
  }

  async getTables(dataSourceId: string) {
    return this.request<any[]>(`/metadata/tables/${dataSourceId}`);
  }

  async previewTableData(tableId: string) {
    return this.request<any[]>(`/metadata/tables/${tableId}/preview`);
  }

  async updateTableExtendedMetadata(tableId: string, data: any) {
    return this.request(`/metadata/table/${tableId}`, { method: 'PUT', body: data });
  }

  async updateColumnExtendedMetadata(columnId: string, data: any) {
    return this.request(`/metadata/column/${columnId}`, { method: 'PUT', body: data });
  }

  async getCodeValues(columnId: string) {
    return this.request<any[]>(`/metadata/column/${columnId}/codes`);
  }

  async createCodeValue(columnId: string, data: any) {
    return this.request(`/metadata/column/${columnId}/codes`, { method: 'POST', body: data });
  }

  async updateCodeValue(codeValueId: string, data: any) {
    return this.request(`/metadata/codes/${codeValueId}`, { method: 'PUT', body: data });
  }

  async deleteCodeValue(codeValueId: string) {
    return this.request(`/metadata/codes/${codeValueId}/delete`, { method: 'POST' });
  }

  async getTableRelationships(tableId: string) {
    return this.request<any[]>(`/metadata/table/${tableId}/relationships`);
  }

  async createRelationship(tableId: string, data: any) {
    return this.request(`/metadata/table/${tableId}/relationships`, { method: 'POST', body: data });
  }

  async deleteRelationship(relationshipId: string) {
    return this.request(`/metadata/relationships/${relationshipId}/delete`, { method: 'POST' });
  }

  async setColumnExcluded(columnId: string, isExcluded: boolean) {
    return this.request(`/metadata/column/${columnId}/exclude`, { method: 'PATCH', body: { isExcluded } });
  }

  async deleteColumn(columnId: string) {
    return this.request(`/metadata/column/${columnId}`, { method: 'DELETE' });
  }

  async exportMetadataExcel(dataSourceId: string) {
    const token = this.getToken();
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(`${API_BASE_URL}/metadata/${dataSourceId}/export`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metadata_${dataSourceId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async importMetadataExcel(dataSourceId: string, file: File) {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('file', file);
    
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(`${API_BASE_URL}/metadata/${dataSourceId}/import`, {
      method: 'POST',
      headers,
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Import failed');
    }
    
    return response.json();
  }

  async downloadMetadataTemplate() {
    const token = this.getToken();
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(`${API_BASE_URL}/metadata/template/download`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) throw new Error('Template download failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metadata_template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // Threads
  async getThreads() {
    return this.request<any[]>('/threads');
  }

  async createThread(data: { title: string }) {
    return this.request<any>('/threads', { method: 'POST', body: data });
  }

  async getThread(id: string) {
    return this.request<any>(`/threads/${id}`);
  }

  async addMessage(threadId: string, data: { role: string; content: string }) {
    return this.request(`/threads/${threadId}/messages`, { method: 'POST', body: data });
  }

  async deleteThread(id: string) {
    return this.request(`/threads/${id}`, { method: 'DELETE' });
  }

  // ==========================================
  // Admin Feedback Management
  // ==========================================
  async getAdminFeedbackList(options?: {
    page?: number;
    limit?: number;
    feedback?: 'POSITIVE' | 'NEGATIVE';
    dataSourceId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    hasNote?: boolean;
  }) {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.feedback) params.set('feedback', options.feedback);
    if (options?.dataSourceId) params.set('dataSourceId', options.dataSourceId);
    if (options?.userId) params.set('userId', options.userId);
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    if (options?.search) params.set('search', options.search);
    if (options?.hasNote !== undefined) params.set('hasNote', String(options.hasNote));
    const query = params.toString();
    return this.request<any>(`/admin/feedback${query ? `?${query}` : ''}`);
  }

  async getAdminFeedbackStats(options?: {
    startDate?: string;
    endDate?: string;
    dataSourceId?: string;
  }) {
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    if (options?.dataSourceId) params.set('dataSourceId', options.dataSourceId);
    const query = params.toString();
    return this.request<any>(`/admin/feedback/stats${query ? `?${query}` : ''}`);
  }

  async getAdminFeedback(id: string) {
    return this.request<any>(`/admin/feedback/${id}`);
  }

  async updateAdminFeedback(id: string, data: { feedbackNote?: string }) {
    return this.request(`/admin/feedback/${id}`, { method: 'PUT', body: data });
  }

  async deleteAdminFeedback(id: string) {
    return this.request(`/admin/feedback/${id}`, { method: 'DELETE' });
  }

  async deleteAdminFeedbackBulk(ids: string[]) {
    return this.request('/admin/feedback/bulk-delete', { method: 'POST', body: { ids } });
  }

  async exportAdminFeedback(options?: {
    feedback?: 'POSITIVE' | 'NEGATIVE';
    dataSourceId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    return this.request<{ filename: string; content: string; count: number }>(
      '/admin/feedback/export',
      { method: 'POST', body: options || {} }
    );
  }
}

export const api = new ApiClient();


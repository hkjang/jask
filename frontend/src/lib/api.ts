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

  // DataSources
  async getDataSources() {
    return this.request<any[]>('/datasources');
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

  async syncMetadata(dataSourceId: string) {
    return this.request(`/metadata/sync/${dataSourceId}`, { method: 'POST' });
  }

  async translateMetadata(dataSourceId: string) {
    // Determine backend URL (assuming localhost:4000 for dev environments)
    // Ideally this should come from env or config. 
    // Since we are fixing a dev-mode proxy timeout, we use the direct backend URL.
    const baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
      ? 'http://localhost:4000/api' 
      : '/api'; 

    // If using direct URL, we need to handle headers manually as request() helper does
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
  async generateQuery(dataSourceId: string, question: string, autoExecute = false) {
    return this.request('/nl2sql/generate', {
      method: 'POST',
      body: { dataSourceId, question, autoExecute },
    });
  }

  async *generateQueryStream(dataSourceId: string, question: string, autoExecute = false): AsyncGenerator<any> {
    const token = this.getToken();
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Use direct URL to bypass Next.js proxy buffering
    const response = await fetch(`http://localhost:4000/api/nl2sql/generate/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ dataSourceId, question, autoExecute }),
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

  async getRecommendedQuestions(dataSourceId: string): Promise<string[]> {
    return this.request<string[]>(`/nl2sql/recommend/${dataSourceId}`, {
      method: 'POST', // Using POST as it triggers generation
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

  async getFavorites() {
    return this.request('/query/favorites');
  }

  async addFavorite(data: { name: string; naturalQuery: string; sqlQuery: string }) {
    return this.request('/query/favorites', { method: 'POST', body: data });
  }

  async removeFavorite(id: string) {
    return this.request(`/query/favorites/${id}`, { method: 'DELETE' });
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

  // Metadata - Extended
  async getSchemaContext(dataSourceId: string) {
    return this.request<{ context: string }>(`/metadata/schema/${dataSourceId}`);
  }

  async getTables(dataSourceId: string) {
    return this.request<any[]>(`/metadata/tables/${dataSourceId}`);
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
}

export const api = new ApiClient();

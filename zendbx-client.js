/**
 * ZENDBX JavaScript Client
 * 
 * A Supabase-compatible client for ZENDBX authentication and data operations.
 * Works exactly like @supabase/supabase-js but for ZENDBX.
 * 
 * @example
 * const zendbx = new ZendbxClient(
 *   'http://localhost:8000',
 *   '6963d283-4a8e-4ac9-9870-bd3d1adc628c',
 *   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 * )
 * 
 * // Signup
 * const { data, error } = await zendbx.auth.signUp({
 *   email: 'user@example.com',
 *   password: 'password123'
 * })
 * 
 * // Login
 * const { data, error } = await zendbx.auth.signIn({
 *   email: 'user@example.com',
 *   password: 'password123'
 * })
 */

class ZendbxClient {
  constructor(apiUrl, projectId, anonKey) {
    this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.projectId = projectId;
    this.anonKey = anonKey;
    this.token = null;
    
    // Initialize auth module
    this.auth = new ZendbxAuth(this);
    
    // Initialize data module
    this.from = (table) => new ZendbxTable(this, table);
    
    // Load token from localStorage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('zendbx_token');
      if (stored) {
        this.token = stored;
      }
    }
  }
  
  /**
   * Set the auth token
   */
  setToken(token) {
    this.token = token;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('zendbx_token', token);
    }
  }
  
  /**
   * Clear the auth token
   */
  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('zendbx_token');
    }
  }
  
  /**
   * Make an authenticated request
   */
  async request(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    // Add auth header
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    } else if (this.anonKey) {
      headers['Authorization'] = `Bearer ${this.anonKey}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        data: null,
        error: {
          message: data.detail || data.message || 'Request failed',
          status: response.status,
          details: data
        }
      };
    }
    
    return { data, error: null };
  }
}

/**
 * Authentication module
 */
class ZendbxAuth {
  constructor(client) {
    this.client = client;
  }
  
  /**
   * Sign up a new user
   * 
   * @param {Object} credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @param {string} [credentials.name] - User name
   * @returns {Promise<{data: Object|null, error: Object|null}>}
   */
  async signUp({ email, password, name }) {
    const endpoint = `/v1/auth/${this.client.projectId}/signup`;
    
    const result = await this.client.request(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        name: name || email.split('@')[0]
      })
    });
    
    if (result.data && result.data.access_token) {
      this.client.setToken(result.data.access_token);
    }
    
    return result;
  }
  
  /**
   * Sign in with email and password
   * 
   * @param {Object} credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @returns {Promise<{data: Object|null, error: Object|null}>}
   */
  async signIn({ email, password }) {
    const endpoint = `/v1/auth/${this.client.projectId}/login`;
    
    const result = await this.client.request(endpoint, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (result.data && result.data.access_token) {
      this.client.setToken(result.data.access_token);
    }
    
    return result;
  }
  
  /**
   * Sign in with password (alias for signIn)
   */
  async signInWithPassword(credentials) {
    return this.signIn(credentials);
  }
  
  /**
   * Get the current user
   * 
   * @returns {Promise<{data: Object|null, error: Object|null}>}
   */
  async getUser() {
    if (!this.client.token) {
      return {
        data: null,
        error: { message: 'Not authenticated' }
      };
    }
    
    const endpoint = `/v1/auth/${this.client.projectId}/user`;
    return this.client.request(endpoint, { method: 'GET' });
  }
  
  /**
   * Sign out the current user
   */
  async signOut() {
    this.client.clearToken();
    return { data: null, error: null };
  }
  
  /**
   * Get the current session
   */
  async getSession() {
    if (!this.client.token) {
      return { data: { session: null }, error: null };
    }
    
    const userResult = await this.getUser();
    
    if (userResult.error) {
      return { data: { session: null }, error: userResult.error };
    }
    
    return {
      data: {
        session: {
          access_token: this.client.token,
          user: userResult.data
        }
      },
      error: null
    };
  }
}

/**
 * Table/Data module
 */
class ZendbxTable {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.queryParams = {
      select: '*',
      filters: [],
      order: null,
      limit: null,
      offset: null
    };
  }
  
  /**
   * Select columns
   */
  select(columns = '*') {
    this.queryParams.select = columns;
    return this;
  }
  
  /**
   * Filter by equality
   */
  eq(column, value) {
    this.queryParams.filters.push({ column, op: 'eq', value });
    return this;
  }
  
  /**
   * Filter by not equal
   */
  neq(column, value) {
    this.queryParams.filters.push({ column, op: 'neq', value });
    return this;
  }
  
  /**
   * Filter by greater than
   */
  gt(column, value) {
    this.queryParams.filters.push({ column, op: 'gt', value });
    return this;
  }
  
  /**
   * Filter by less than
   */
  lt(column, value) {
    this.queryParams.filters.push({ column, op: 'lt', value });
    return this;
  }
  
  /**
   * Order results
   */
  order(column, { ascending = true } = {}) {
    this.queryParams.order = { column, ascending };
    return this;
  }
  
  /**
   * Limit results
   */
  limit(count) {
    this.queryParams.limit = count;
    return this;
  }
  
  /**
   * Offset results
   */
  range(from, to) {
    this.queryParams.offset = from;
    this.queryParams.limit = to - from + 1;
    return this;
  }
  
  /**
   * Execute the query
   */
  async execute() {
    const endpoint = `/rest/v1/${this.table}`;
    
    // Build query string
    const params = new URLSearchParams();
    params.append('select', this.queryParams.select);
    
    // Add filters
    this.queryParams.filters.forEach(filter => {
      params.append(filter.column, `${filter.op}.${filter.value}`);
    });
    
    // Add order
    if (this.queryParams.order) {
      const direction = this.queryParams.order.ascending ? 'asc' : 'desc';
      params.append('order', `${this.queryParams.order.column}.${direction}`);
    }
    
    // Add limit
    if (this.queryParams.limit) {
      params.append('limit', this.queryParams.limit);
    }
    
    // Add offset
    if (this.queryParams.offset) {
      params.append('offset', this.queryParams.offset);
    }
    
    return this.client.request(`${endpoint}?${params.toString()}`, {
      method: 'GET'
    });
  }
  
  /**
   * Insert data
   */
  async insert(data) {
    const endpoint = `/rest/v1/${this.table}`;
    return this.client.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * Update data
   */
  async update(data) {
    const endpoint = `/rest/v1/${this.table}`;
    
    // Build query string for filters
    const params = new URLSearchParams();
    this.queryParams.filters.forEach(filter => {
      params.append(filter.column, `${filter.op}.${filter.value}`);
    });
    
    return this.client.request(`${endpoint}?${params.toString()}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * Delete data
   */
  async delete() {
    const endpoint = `/rest/v1/${this.table}`;
    
    // Build query string for filters
    const params = new URLSearchParams();
    this.queryParams.filters.forEach(filter => {
      params.append(filter.column, `${filter.op}.${filter.value}`);
    });
    
    return this.client.request(`${endpoint}?${params.toString()}`, {
      method: 'DELETE'
    });
  }
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZendbxClient };
}

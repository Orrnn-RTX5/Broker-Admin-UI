import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

const DEFAULT_BASE_URL = '/manager';

const apiClient = {
  async request(endpoint, options = {}) {
    let url = endpoint.startsWith('http') ? endpoint : `${DEFAULT_BASE_URL}${endpoint}`;
    
    // Add ?id=token to the URL because the MetaTrader 5 web APIs require it
    const token = useAuthStore.getState().accessToken;
    if (token) {
      try {
        // Safe parsing of relative or absolute URL
        const urlObj = new URL(url, window.location.origin);
        urlObj.searchParams.set('id', token);
        url = urlObj.pathname + urlObj.search;
      } catch (e) {
        // fallback for very weird urls
      }
    }
    
    try {
      const response = await api({
        url,
        method: options.method || 'GET',
        data: options.body ? JSON.parse(options.body) : undefined,
        headers: options.headers,
      });
      
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        throw new Error(error.response.data.error || error.response.data.message || `HTTP ${error.response.status}`);
      }
      throw error;
    }
  },

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  },

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
};

export default apiClient;

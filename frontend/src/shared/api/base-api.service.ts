/**
 * API 基础服务类 - 跨平台共享
 * 提供统一的 HTTP 请求处理、错误处理、Token 管理等功能
 */

import type { 
  ApiResponse, 
  ApiError, 
  RequestConfig,
  TokenPair 
} from '../types/api.types';

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  withCredentials?: boolean;
  headers?: Record<string, string>;
  onTokenRefresh?: () => Promise<TokenPair>;
  onAuthError?: () => void;
}

export abstract class BaseApiService {
  protected config: ApiClientConfig;
  private isRefreshing = false;
  private refreshQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
  }> = [];

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000,
      withCredentials: true,
      ...config
    };
  }

  /**
   * 获取存储的 Token
   * 子类需要实现具体的存储逻辑（localStorage, AsyncStorage 等）
   */
  protected abstract getStoredToken(): string | null;
  protected abstract setStoredToken(token: string): void;
  protected abstract getStoredRefreshToken(): string | null;
  protected abstract setStoredRefreshToken(token: string): void;
  protected abstract clearStoredTokens(): void;

  /**
   * 获取 CSRF Token
   * 子类可以重写此方法以适应不同平台
   */
  protected getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    
    const name = 'csrf-token=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookies = decodedCookie.split(';');
    
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.indexOf(name) === 0) {
        return cookie.substring(name.length);
      }
    }
    return null;
  }

  /**
   * 构建请求头
   */
  protected buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...customHeaders
    };

    const token = this.getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const csrfToken = this.getCsrfToken();
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }

    return headers;
  }

  /**
   * 统一的请求方法
   */
  protected async request<T>(
    method: string,
    endpoint: string,
    options: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`;
    const headers = this.buildHeaders(options.headers);

    try {
      const response = await this.performRequest(method, url, {
        ...options,
        headers,
        timeout: options.timeout || this.config.timeout,
        withCredentials: options.withCredentials ?? this.config.withCredentials
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError(error, method, endpoint, options);
    }
  }

  /**
   * 执行实际的 HTTP 请求
   * 子类需要实现具体的请求逻辑（fetch, axios, XMLHttpRequest 等）
   */
  protected abstract performRequest(
    method: string,
    url: string,
    options: RequestConfig
  ): Promise<any>;

  /**
   * 处理响应
   */
  protected async handleResponse<T>(response: any): Promise<ApiResponse<T>> {
    // 处理 401 认证错误
    if (response.status === 401) {
      return this.handleAuthError(response);
    }

    // 处理其他 HTTP 错误
    if (!response.ok || response.status >= 400) {
      return this.createErrorResponse(response);
    }

    // 解析成功响应
    try {
      const data = await response.json();
      return {
        success: true,
        data: data.data || data,
        message: data.message
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: '响应解析失败'
        }
      };
    }
  }

  /**
   * 处理认证错误
   */
  protected async handleAuthError(response: any): Promise<ApiResponse<any>> {
    // 如果正在刷新 Token，加入队列等待
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.refreshQueue.push({ resolve, reject });
      }).then(token => {
        // 使用新 Token 重试请求
        return this.retryWithNewToken(response.url, response.config);
      });
    }

    // 开始刷新 Token
    this.isRefreshing = true;

    try {
      if (this.config.onTokenRefresh) {
        const tokens = await this.config.onTokenRefresh();
        this.setStoredToken(tokens.accessToken);
        this.setStoredRefreshToken(tokens.refreshToken);
        
        // 处理等待队列
        this.processRefreshQueue(null, tokens.accessToken);
        
        // 重试原始请求
        return this.retryWithNewToken(response.url, response.config);
      }
    } catch (error) {
      this.processRefreshQueue(error, null);
      this.clearStoredTokens();
      
      if (this.config.onAuthError) {
        this.config.onAuthError();
      }
      
      return this.createErrorResponse(response);
    } finally {
      this.isRefreshing = false;
    }

    return this.createErrorResponse(response);
  }

  /**
   * 处理刷新队列
   */
  private processRefreshQueue(error: any, token: string | null) {
    this.refreshQueue.forEach(promise => {
      if (error) {
        promise.reject(error);
      } else if (token) {
        promise.resolve(token);
      }
    });
    this.refreshQueue = [];
  }

  /**
   * 使用新 Token 重试请求
   */
  protected abstract retryWithNewToken(url: string, config: any): Promise<ApiResponse<any>>;

  /**
   * 处理错误
   */
  protected handleError(error: any, method: string, endpoint: string, options: RequestConfig): ApiResponse<any> {
    console.error(`[API Error] ${method} ${endpoint}:`, error);

    if (error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'REQUEST_ABORTED',
          message: '请求已取消'
        }
      };
    }

    if (error.name === 'TimeoutError' || error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: '请求超时，请检查网络连接'
        }
      };
    }

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: '网络错误，请检查连接'
      }
    };
  }

  /**
   * 创建错误响应
   */
  protected createErrorResponse(response: any): ApiResponse<any> {
    const statusCode = response.status || 500;
    let message = '请求失败';
    let code = 'REQUEST_FAILED';

    switch (statusCode) {
      case 400:
        message = '请求参数错误';
        code = 'BAD_REQUEST';
        break;
      case 401:
        message = '认证失败，请重新登录';
        code = 'UNAUTHORIZED';
        break;
      case 403:
        message = '没有权限访问此资源';
        code = 'FORBIDDEN';
        break;
      case 404:
        message = '请求的资源不存在';
        code = 'NOT_FOUND';
        break;
      case 500:
        message = '服务器内部错误';
        code = 'INTERNAL_SERVER_ERROR';
        break;
    }

    return {
      success: false,
      error: {
        code,
        message,
        statusCode
      }
    };
  }

  // 便捷方法
  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, config);
  }

  async post<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, {
      ...config,
      body: JSON.stringify(data)
    });
  }

  async put<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, {
      ...config,
      body: JSON.stringify(data)
    });
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, config);
  }

  async patch<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, {
      ...config,
      body: JSON.stringify(data)
    });
  }
}
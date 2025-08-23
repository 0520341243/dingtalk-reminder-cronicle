/**
 * 移动端 API 客户端适配器
 * 基于 React Native 或移动端 Web 的具体实现
 */

import { BaseApiService, ApiClientConfig } from '../../shared/api/base-api.service';
import type { ApiResponse, RequestConfig } from '../../shared/types/api.types';

/**
 * 移动端 API 客户端实现
 * 可以适配 React Native 的 fetch 或其他 HTTP 库
 */
export class MobileApiClient extends BaseApiService {
  constructor(config: ApiClientConfig) {
    super(config);
  }

  /**
   * 获取存储的 Token
   * 移动端使用 localStorage 或 AsyncStorage
   */
  protected getStoredToken(): string | null {
    // React Native 环境
    if (typeof window === 'undefined') {
      // 这里应该使用 AsyncStorage.getItem('token')
      // 由于是同步方法，可以考虑在初始化时预加载
      return null;
    }
    
    // 移动端 Web 环境
    return localStorage.getItem('token');
  }

  protected setStoredToken(token: string): void {
    // React Native 环境
    if (typeof window === 'undefined') {
      // AsyncStorage.setItem('token', token)
      return;
    }
    
    // 移动端 Web 环境
    localStorage.setItem('token', token);
  }

  protected getStoredRefreshToken(): string | null {
    // React Native 环境
    if (typeof window === 'undefined') {
      // AsyncStorage.getItem('refreshToken')
      return null;
    }
    
    // 移动端 Web 环境
    return localStorage.getItem('refreshToken');
  }

  protected setStoredRefreshToken(token: string): void {
    // React Native 环境
    if (typeof window === 'undefined') {
      // AsyncStorage.setItem('refreshToken', token)
      return;
    }
    
    // 移动端 Web 环境
    localStorage.setItem('refreshToken', token);
  }

  protected clearStoredTokens(): void {
    // React Native 环境
    if (typeof window === 'undefined') {
      // AsyncStorage.multiRemove(['token', 'refreshToken'])
      return;
    }
    
    // 移动端 Web 环境
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  /**
   * 移动端可能不需要 CSRF Token
   */
  protected getCsrfToken(): string | null {
    // 移动端 APP 通常不需要 CSRF Token
    if (typeof window === 'undefined') {
      return null;
    }
    
    // 移动端 Web 仍然需要
    return super.getCsrfToken();
  }

  /**
   * 执行实际的 HTTP 请求
   * 使用 fetch API，兼容 React Native
   */
  protected async performRequest(
    method: string,
    url: string,
    options: RequestConfig
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || this.config.timeout || 30000
    );

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: options.headers,
        signal: controller.signal,
        credentials: options.withCredentials ? 'include' : 'same-origin'
      };

      // 添加请求体
      if (options.body && method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body = options.body;
      }

      // 处理查询参数
      let finalUrl = url;
      if (options.params && Object.keys(options.params).length > 0) {
        const queryString = new URLSearchParams(options.params).toString();
        finalUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
      }

      const response = await fetch(finalUrl, fetchOptions);
      clearTimeout(timeoutId);

      // 添加 config 到 response 以便重试
      (response as any).config = { method, url: finalUrl, ...options };

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        error.code = 'ECONNABORTED';
      }
      
      throw error;
    }
  }

  /**
   * 使用新 Token 重试请求
   */
  protected async retryWithNewToken(url: string, config: any): Promise<ApiResponse<any>> {
    const newToken = this.getStoredToken();
    
    if (!newToken) {
      return {
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: '无法获取新的认证令牌'
        }
      };
    }

    // 更新请求头
    const headers = {
      ...config.headers,
      Authorization: `Bearer ${newToken}`
    };

    // 重新发起请求
    return this.request(config.method, url.replace(this.config.baseURL, ''), {
      ...config,
      headers
    });
  }

  /**
   * 上传文件（移动端特有）
   */
  async uploadFile(
    endpoint: string,
    file: File | Blob,
    additionalData?: Record<string, any>
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    
    // 添加文件
    if (file instanceof File) {
      formData.append('file', file, file.name);
    } else {
      formData.append('file', file);
    }
    
    // 添加其他数据
    if (additionalData) {
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });
    }

    const headers = this.buildHeaders();
    // 移除 Content-Type，让浏览器自动设置
    delete headers['Content-Type'];

    return this.request('POST', endpoint, {
      headers,
      body: formData as any
    });
  }

  /**
   * 下载文件（移动端特有）
   */
  async downloadFile(endpoint: string): Promise<Blob> {
    const url = `${this.config.baseURL}${endpoint}`;
    const headers = this.buildHeaders();

    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: this.config.withCredentials ? 'include' : 'same-origin'
    });

    if (!response.ok) {
      throw new Error(`下载失败: ${response.statusText}`);
    }

    return response.blob();
  }
}

/**
 * 创建移动端 API 客户端实例
 */
export function createMobileApiClient(config?: Partial<ApiClientConfig>): MobileApiClient {
  // 动态设置 API 基础 URL
  const getBaseURL = () => {
    // 开发环境
    if (process.env.NODE_ENV === 'development') {
      return process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
    }
    
    // 生产环境
    const hostname = window?.location?.hostname || 'localhost';
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000/api';
    }
    
    // 局域网或其他地址
    return `http://${hostname}:3000/api`;
  };

  return new MobileApiClient({
    baseURL: getBaseURL(),
    timeout: 30000,
    withCredentials: true,
    ...config
  });
}
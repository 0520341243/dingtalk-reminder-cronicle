/**
 * 通用数据获取 Hook - 跨平台共享
 * 基于桌面端 useRefresh.js 的逻辑抽象
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ApiResponse } from '../types/api.types';

export interface UseApiDataOptions<T> {
  /**
   * API 调用函数
   */
  apiCall: () => Promise<ApiResponse<T>>;
  
  /**
   * 依赖数组，当依赖变化时重新获取数据
   */
  dependencies?: any[];
  
  /**
   * 是否在组件挂载时自动获取数据
   */
  fetchOnMount?: boolean;
  
  /**
   * 是否启用轮询
   */
  polling?: boolean;
  
  /**
   * 轮询间隔（毫秒）
   */
  pollingInterval?: number;
  
  /**
   * 重试次数
   */
  retryCount?: number;
  
  /**
   * 重试延迟（毫秒）
   */
  retryDelay?: number;
  
  /**
   * 成功回调
   */
  onSuccess?: (data: T) => void;
  
  /**
   * 错误回调
   */
  onError?: (error: any) => void;
}

export interface UseApiDataResult<T> {
  /**
   * 数据
   */
  data: T | null;
  
  /**
   * 是否正在加载
   */
  loading: boolean;
  
  /**
   * 错误信息
   */
  error: any | null;
  
  /**
   * 手动刷新数据
   */
  refetch: () => Promise<void>;
  
  /**
   * 设置数据（用于乐观更新）
   */
  setData: (data: T | null) => void;
  
  /**
   * 清除错误
   */
  clearError: () => void;
  
  /**
   * 取消请求
   */
  cancel: () => void;
}

/**
 * 通用数据获取 Hook
 */
export function useApiData<T>(
  options: UseApiDataOptions<T>
): UseApiDataResult<T> {
  const {
    apiCall,
    dependencies = [],
    fetchOnMount = true,
    polling = false,
    pollingInterval = 30000,
    retryCount = 3,
    retryDelay = 1000,
    onSuccess,
    onError
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  /**
   * 取消当前请求
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 执行 API 调用
   */
  const fetchData = useCallback(async () => {
    // 检查组件是否已卸载
    if (!mountedRef.current) return;

    // 取消之前的请求
    cancel();

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const response = await apiCall();

      // 检查组件是否已卸载
      if (!mountedRef.current) return;

      if (response.success && response.data !== undefined) {
        setData(response.data);
        retryCountRef.current = 0; // 重置重试计数
        
        if (onSuccess) {
          onSuccess(response.data);
        }
      } else {
        throw response.error || new Error('请求失败');
      }
    } catch (err: any) {
      // 检查组件是否已卸载
      if (!mountedRef.current) return;

      // 忽略取消错误
      if (err.name === 'AbortError') return;

      setError(err);
      
      // 自动重试
      if (retryCountRef.current < retryCount) {
        retryCountRef.current++;
        console.log(`[useApiData] 重试 ${retryCountRef.current}/${retryCount}`);
        
        setTimeout(() => {
          if (mountedRef.current) {
            fetchData();
          }
        }, retryDelay * retryCountRef.current);
      } else {
        if (onError) {
          onError(err);
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiCall, cancel, retryCount, retryDelay, onSuccess, onError]);

  /**
   * 手动刷新数据
   */
  const refetch = useCallback(async () => {
    retryCountRef.current = 0; // 重置重试计数
    await fetchData();
  }, [fetchData]);

  /**
   * 启动轮询
   */
  const startPolling = useCallback(() => {
    if (!polling || pollingTimerRef.current) return;

    pollingTimerRef.current = setInterval(() => {
      if (mountedRef.current && document.visibilityState === 'visible') {
        fetchData();
      }
    }, pollingInterval);
  }, [polling, pollingInterval, fetchData]);

  /**
   * 停止轮询
   */
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  /**
   * 处理页面可见性变化
   */
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && !loading) {
      fetchData();
    }
  }, [fetchData, loading]);

  // 初始化和依赖变化时获取数据
  useEffect(() => {
    if (fetchOnMount) {
      fetchData();
    }

    // 启动轮询
    if (polling) {
      startPolling();
    }

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cancel();
      stopPolling();
    };
  }, [cancel, stopPolling]);

  return {
    data,
    loading,
    error,
    refetch,
    setData,
    clearError,
    cancel
  };
}

/**
 * 批量数据获取 Hook
 */
export function useMultipleApiData<T extends Record<string, any>>(
  apiCalls: Record<keyof T, () => Promise<ApiResponse<any>>>,
  options?: Omit<UseApiDataOptions<any>, 'apiCall'>
): Record<keyof T, UseApiDataResult<any>> {
  const results: any = {};

  for (const key in apiCalls) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[key] = useApiData({
      ...options,
      apiCall: apiCalls[key]
    });
  }

  return results;
}
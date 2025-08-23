/**
 * 智能刷新 Hook - 跨平台共享
 * 基于桌面端 useRefresh.js 的智能刷新逻辑
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// 全局事件总线
class GlobalEventBus {
  private events: Record<string, Array<(...args: any[]) => void>> = {};
  private refreshQueue = new Set<{ key: string; refreshFn: () => Promise<void>; timestamp: number }>();
  private isRefreshing = false;
  private refreshTimer: NodeJS.Timeout | null = null;

  // 订阅事件
  on(event: string, callback: (...args: any[]) => void) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  // 取消订阅
  off(event: string, callback: (...args: any[]) => void) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  // 触发事件
  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`[GlobalEventBus] 事件处理器执行失败 - ${event}:`, error);
      }
    });
  }

  // 添加到刷新队列
  queueRefresh(key: string, refreshFn: () => Promise<void>, delay = 500) {
    if (this.isRefreshing) {
      console.log(`[GlobalEventBus] 刷新中，跳过 ${key}`);
      return;
    }

    this.refreshQueue.add({ key, refreshFn, timestamp: Date.now() });
    
    // 防抖动处理
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    this.refreshTimer = setTimeout(() => {
      this.processRefreshQueue();
    }, delay);
  }

  // 处理刷新队列
  async processRefreshQueue() {
    if (this.refreshQueue.size === 0 || this.isRefreshing) return;

    this.isRefreshing = true;
    console.log(`[GlobalEventBus] 开始批量刷新，队列大小: ${this.refreshQueue.size}`);

    const refreshItems = Array.from(this.refreshQueue);
    this.refreshQueue.clear();

    try {
      // 并行执行刷新任务，但限制并发数
      const concurrentLimit = 3;
      for (let i = 0; i < refreshItems.length; i += concurrentLimit) {
        const batch = refreshItems.slice(i, i + concurrentLimit);
        await Promise.all(
          batch.map(async ({ key, refreshFn }) => {
            try {
              await refreshFn();
              console.log(`[GlobalEventBus] 刷新成功: ${key}`);
            } catch (error) {
              console.error(`[GlobalEventBus] 刷新失败: ${key}`, error);
            }
          })
        );
        
        // 批次间短暂延迟，避免服务器压力
        if (i + concurrentLimit < refreshItems.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      this.isRefreshing = false;
      console.log('[GlobalEventBus] 批量刷新完成');
    }
  }
}

// 全局事件总线实例
const globalEventBus = new GlobalEventBus();

/**
 * 智能刷新配置
 */
export interface SmartRefreshConfig {
  // 防抖动延迟
  debounceDelay?: number;
  // 自动刷新间隔（毫秒）
  autoRefreshInterval?: number;
  // 最大重试次数
  maxRetries?: number;
  // 重试延迟
  retryDelay?: number;
  // Token刷新冷却时间
  tokenRefreshCooldown?: number;
}

const DEFAULT_CONFIG: SmartRefreshConfig = {
  debounceDelay: 500,
  autoRefreshInterval: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  tokenRefreshCooldown: 5000
};

export interface UseSmartRefreshOptions {
  fetchFn?: () => Promise<void>;
  key?: string;
  autoRefresh?: boolean;
  interval?: number;
  events?: string[];
  dependencies?: any[];
  isAuthenticated?: boolean;
  config?: SmartRefreshConfig;
}

export interface UseSmartRefreshResult {
  loading: boolean;
  error: any | null;
  lastRefresh: number | null;
  retryCount: number;
  canRefresh: boolean;
  refresh: (force?: boolean) => Promise<void>;
  queueRefresh: () => void;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
}

/**
 * 使用智能刷新的 Hook
 */
export function useSmartRefresh(options: UseSmartRefreshOptions = {}): UseSmartRefreshResult {
  const {
    fetchFn,
    key = 'default',
    autoRefresh = false,
    interval,
    events = [],
    dependencies = [],
    isAuthenticated = true,
    config = DEFAULT_CONFIG
  } = options;

  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const finalInterval = interval || finalConfig.autoRefreshInterval;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // 计算是否可以刷新
  const canRefresh = (() => {
    // 检查认证状态
    if (!isAuthenticated) {
      return false;
    }
    
    // 检查是否在Token刷新冷却期
    if (lastRefresh && finalConfig.tokenRefreshCooldown) {
      const now = Date.now();
      const cooldownEnd = lastRefresh + finalConfig.tokenRefreshCooldown;
      if (now < cooldownEnd) {
        return false;
      }
    }
    
    return !loading;
  })();

  // 手动刷新函数
  const refresh = useCallback(async (force = false) => {
    if (!force && !canRefresh) {
      console.log(`[useSmartRefresh] 跳过刷新 - ${key}, canRefresh: ${canRefresh}`);
      return;
    }

    if (!fetchFn) {
      console.warn(`[useSmartRefresh] 缺少fetchFn - ${key}`);
      return;
    }

    if (!mountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      console.log(`[useSmartRefresh] 开始刷新 - ${key}`);
      await fetchFn();
      
      if (mountedRef.current) {
        setLastRefresh(Date.now());
        setRetryCount(0);
        console.log(`[useSmartRefresh] 刷新成功 - ${key}`);
        
        // 触发刷新完成事件
        globalEventBus.emit('refresh:complete', key);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      setError(err);
      console.error(`[useSmartRefresh] 刷新失败 - ${key}:`, err);

      // 自动重试机制
      if (finalConfig.maxRetries && retryCount < finalConfig.maxRetries) {
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);
        console.log(`[useSmartRefresh] 开始重试 ${newRetryCount}/${finalConfig.maxRetries} - ${key}`);
        
        setTimeout(() => {
          if (mountedRef.current) {
            refresh(true);
          }
        }, (finalConfig.retryDelay || 1000) * newRetryCount);
      } else {
        console.error(`[useSmartRefresh] 重试次数已达上限 - ${key}`);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [canRefresh, fetchFn, key, retryCount, finalConfig.maxRetries, finalConfig.retryDelay]);

  // 队列刷新函数（防抖动）
  const queueRefresh = useCallback(() => {
    globalEventBus.queueRefresh(key, refresh, finalConfig.debounceDelay);
  }, [key, refresh, finalConfig.debounceDelay]);

  // 启动自动刷新
  const startAutoRefresh = useCallback(() => {
    if (autoRefreshTimerRef.current) return;

    autoRefreshTimerRef.current = setInterval(() => {
      if (mountedRef.current && canRefresh && document.visibilityState === 'visible') {
        refresh();
      }
    }, finalInterval);

    console.log(`[useSmartRefresh] 启动自动刷新 - ${key}, 间隔: ${finalInterval}ms`);
  }, [canRefresh, refresh, key, finalInterval]);

  // 停止自动刷新
  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
      console.log(`[useSmartRefresh] 停止自动刷新 - ${key}`);
    }
  }, [key]);

  // 页面可见性变化处理
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && canRefresh) {
      queueRefresh();
    }
  }, [canRefresh, queueRefresh]);

  // 事件处理器
  useEffect(() => {
    const eventHandlers: Record<string, () => void> = {};

    // 监听指定事件
    events.forEach(event => {
      eventHandlers[event] = () => {
        console.log(`[useSmartRefresh] 收到事件 ${event} - ${key}`);
        queueRefresh();
      };
      globalEventBus.on(event, eventHandlers[event]);
    });

    // 清理函数
    return () => {
      events.forEach(event => {
        if (eventHandlers[event]) {
          globalEventBus.off(event, eventHandlers[event]);
        }
      });
    };
  }, [events, key, queueRefresh]);

  // 初始化和依赖变化处理
  useEffect(() => {
    // 初始数据加载
    if (fetchFn && canRefresh) {
      refresh(true);
    }

    // 启动自动刷新（如果启用）
    if (autoRefresh) {
      startAutoRefresh();
    }

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 清理函数
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopAutoRefresh();
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopAutoRefresh();
    };
  }, [stopAutoRefresh]);

  return {
    loading,
    error,
    lastRefresh,
    retryCount,
    canRefresh,
    refresh,
    queueRefresh,
    startAutoRefresh,
    stopAutoRefresh
  };
}

/**
 * 全局事件触发器
 */
export const refreshEvents = {
  // 文件相关事件
  fileUploaded: (fileInfo: any) => globalEventBus.emit('file:uploaded', fileInfo),
  fileDeleted: (fileId: string) => globalEventBus.emit('file:deleted', fileId),
  filesChanged: () => globalEventBus.emit('files:changed'),

  // 群组相关事件
  groupCreated: (groupInfo: any) => globalEventBus.emit('group:created', groupInfo),
  groupCopied: (copyInfo: any) => globalEventBus.emit('group:copied', copyInfo),
  groupUpdated: (groupId: string) => globalEventBus.emit('group:updated', groupId),
  groupDeleted: (groupId: string) => globalEventBus.emit('group:deleted', groupId),
  groupsChanged: () => globalEventBus.emit('groups:changed'),

  // 提醒相关事件
  reminderCreated: (reminderInfo: any) => globalEventBus.emit('reminder:created', reminderInfo),
  reminderUpdated: (reminderId: string) => globalEventBus.emit('reminder:updated', reminderId),
  reminderDeleted: (reminderId: string) => globalEventBus.emit('reminder:deleted', reminderId),
  remindersChanged: () => globalEventBus.emit('reminders:changed'),

  // 系统事件
  dataChanged: () => globalEventBus.emit('data:changed'),
  authChanged: () => globalEventBus.emit('auth:changed')
};

/**
 * 页面级别的智能刷新配置
 */
export const pageRefreshConfig = {
  files: {
    key: 'files',
    autoRefresh: true,
    interval: 30000,
    events: ['file:uploaded', 'file:deleted', 'files:changed', 'data:changed']
  },
  groups: {
    key: 'groups',
    autoRefresh: true,
    interval: 30000,
    events: ['group:created', 'group:copied', 'group:updated', 'group:deleted', 'groups:changed', 'data:changed']
  },
  reminders: {
    key: 'reminders',
    autoRefresh: true,
    interval: 20000,
    events: ['reminder:created', 'reminder:updated', 'reminder:deleted', 'reminders:changed', 'data:changed']
  },
  dashboard: {
    key: 'dashboard',
    autoRefresh: true,
    interval: 15000,
    events: ['data:changed', 'auth:changed']
  },
  settings: {
    key: 'settings',
    autoRefresh: false,
    events: ['data:changed']
  }
};
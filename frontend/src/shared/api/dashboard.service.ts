/**
 * 仪表板 API 服务 - 跨平台共享
 * 基于桌面端 dashboard.js 的逻辑抽象
 */

import type { 
  ApiResponse,
  DashboardOverview,
  SystemStatus,
  Statistics,
  ErrorReport,
  PerformanceMetrics
} from '../types/api.types';

export interface DashboardService {
  /**
   * 获取仪表板概览数据
   */
  getOverview(): Promise<ApiResponse<DashboardOverview>>;

  /**
   * 获取实时状态信息
   */
  getStatus(): Promise<ApiResponse<SystemStatus>>;

  /**
   * 获取消息发送统计
   * @param params 查询参数（开始时间、结束时间、分组等）
   */
  getStatistics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<ApiResponse<Statistics>>;

  /**
   * 获取错误报告
   * @param params 查询参数（时间范围、级别、状态等）
   */
  getErrors(params?: {
    startDate?: string;
    endDate?: string;
    level?: 'error' | 'warning' | 'info';
    resolved?: boolean;
    limit?: number;
  }): Promise<ApiResponse<ErrorReport[]>>;

  /**
   * 获取性能指标
   * @param params 查询参数（时间范围、指标类型等）
   */
  getPerformance(params?: {
    startDate?: string;
    endDate?: string;
    metrics?: string[];
  }): Promise<ApiResponse<PerformanceMetrics>>;
}

/**
 * 创建仪表板服务实例
 * @param apiClient API 客户端实例
 */
export function createDashboardService(apiClient: any): DashboardService {
  return {
    getOverview() {
      return apiClient.get<DashboardOverview>('/mongo/dashboard/overview');
    },

    getStatus() {
      return apiClient.get<SystemStatus>('/mongo/dashboard/status');
    },

    getStatistics(params = {}) {
      return apiClient.get<Statistics>('/mongo/dashboard/statistics', { params });
    },

    getErrors(params = {}) {
      return apiClient.get<ErrorReport[]>('/mongo/dashboard/errors', { params });
    },

    getPerformance(params = {}) {
      return apiClient.get<PerformanceMetrics>('/mongo/dashboard/performance', { params });
    }
  };
}
/**
 * API 相关类型定义 - 跨平台共享
 * 基于桌面端 API 结构抽象的通用类型
 */

// API 响应基础结构
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

// API 错误结构
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode?: number;
}

// 分页参数
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// 分页响应
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 请求配置
export interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
  withCredentials?: boolean;
  signal?: AbortSignal;
}

// Token 相关
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthTokens extends TokenPair {
  expiresIn?: number;
  tokenType?: string;
}

// 用户相关
export interface User {
  id: string;
  username: string;
  email?: string;
  role?: string;
  permissions?: string[];
  avatar?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 仪表板统计
export interface DashboardOverview {
  tasks: {
    total: number;
    active: number;
    inactive: number;
    completed?: number;
  };
  groups: {
    total: number;
    active: number;
  };
  execution?: {
    todayExecuted: number;
    pending: number;
    failed?: number;
  };
  scheduler?: {
    running: boolean;
    jobs: number;
    lastCheck?: string;
  };
}

// 状态信息
export interface SystemStatus {
  scheduler: {
    running: boolean;
    jobs: number;
    uptime?: number;
  };
  execution: {
    todayExecuted: number;
    pending: number;
    processing?: number;
  };
  system?: {
    memory?: number;
    cpu?: number;
    version?: string;
  };
}

// 统计数据
export interface Statistics {
  period: string;
  data: Array<{
    date: string;
    count: number;
    success?: number;
    failed?: number;
  }>;
  summary?: {
    total: number;
    average: number;
    peak: number;
  };
}

// 错误报告
export interface ErrorReport {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  context?: any;
  resolved?: boolean;
}

// 性能指标
export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  uptime: number;
  measurements?: Array<{
    metric: string;
    value: number;
    unit: string;
  }>;
}
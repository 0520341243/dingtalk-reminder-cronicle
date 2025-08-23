/**
 * 移动端认证 Hook
 * 处理移动端特有的认证逻辑
 */

import { useState, useEffect, useCallback } from 'react';
import type { User, TokenPair } from '../../shared/types/api.types';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
}

export interface UseMobileAuthOptions {
  apiClient: any;
  onAuthSuccess?: (user: User) => void;
  onAuthError?: (error: any) => void;
  onLogout?: () => void;
}

/**
 * 移动端认证 Hook
 */
export function useMobileAuth(options: UseMobileAuthOptions) {
  const { apiClient, onAuthSuccess, onAuthError, onLogout } = options;

  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    loading: true
  });

  /**
   * 登录
   */
  const login = useCallback(async (username: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));

      const response = await apiClient.post('/mongo/auth/login', {
        username,
        password
      });

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;

        // 存储 Token
        apiClient.setStoredToken(accessToken);
        apiClient.setStoredRefreshToken(refreshToken);

        // 更新状态
        setAuthState({
          user,
          isAuthenticated: true,
          isAdmin: user.role === 'admin',
          loading: false
        });

        if (onAuthSuccess) {
          onAuthSuccess(user);
        }

        return { success: true, user };
      } else {
        throw new Error(response.error?.message || '登录失败');
      }
    } catch (error) {
      setAuthState(prev => ({ ...prev, loading: false }));
      
      if (onAuthError) {
        onAuthError(error);
      }

      return { 
        success: false, 
        error: error instanceof Error ? error.message : '登录失败' 
      };
    }
  }, [apiClient, onAuthSuccess, onAuthError]);

  /**
   * 登出
   */
  const logout = useCallback(async () => {
    try {
      // 调用登出 API
      await apiClient.post('/mongo/auth/logout');
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      // 清除本地状态
      apiClient.clearStoredTokens();
      
      setAuthState({
        user: null,
        isAuthenticated: false,
        isAdmin: false,
        loading: false
      });

      if (onLogout) {
        onLogout();
      }
    }
  }, [apiClient, onLogout]);

  /**
   * 刷新 Token
   */
  const refreshToken = useCallback(async (): Promise<TokenPair | null> => {
    try {
      const refreshToken = apiClient.getStoredRefreshToken();
      
      if (!refreshToken) {
        throw new Error('没有刷新令牌');
      }

      const response = await apiClient.post('/mongo/auth/refresh', {
        refreshToken
      });

      if (response.success && response.data) {
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        // 更新存储的 Token
        apiClient.setStoredToken(accessToken);
        apiClient.setStoredRefreshToken(newRefreshToken);

        return { accessToken, refreshToken: newRefreshToken };
      } else {
        throw new Error('刷新令牌失败');
      }
    } catch (error) {
      console.error('刷新令牌失败:', error);
      
      // 清除认证状态
      await logout();
      
      return null;
    }
  }, [apiClient, logout]);

  /**
   * 获取用户信息
   */
  const fetchUserProfile = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));

      const response = await apiClient.get('/mongo/auth/profile');

      if (response.success && response.data) {
        const user = response.data;
        
        setAuthState({
          user,
          isAuthenticated: true,
          isAdmin: user.role === 'admin',
          loading: false
        });

        return user;
      } else {
        throw new Error('获取用户信息失败');
      }
    } catch (error) {
      // 如果是 401 错误，说明未认证
      if (error?.response?.status === 401) {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isAdmin: false,
          loading: false
        });
      } else {
        setAuthState(prev => ({ ...prev, loading: false }));
      }
      
      return null;
    }
  }, [apiClient]);

  /**
   * 初始化认证状态
   */
  const initializeAuth = useCallback(async () => {
    const token = apiClient.getStoredToken();
    
    if (token) {
      // 有 Token，尝试获取用户信息
      await fetchUserProfile();
    } else {
      // 没有 Token，设置为未认证状态
      setAuthState({
        user: null,
        isAuthenticated: false,
        isAdmin: false,
        loading: false
      });
    }
  }, [apiClient, fetchUserProfile]);

  /**
   * 更新用户信息
   */
  const updateUser = useCallback((user: Partial<User>) => {
    setAuthState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...user } : null
    }));
  }, []);

  /**
   * 检查权限
   */
  const hasPermission = useCallback((permission: string): boolean => {
    if (!authState.user) return false;
    
    // 管理员拥有所有权限
    if (authState.isAdmin) return true;
    
    // 检查用户权限列表
    return authState.user.permissions?.includes(permission) || false;
  }, [authState.user, authState.isAdmin]);

  // 配置 API 客户端的 Token 刷新回调
  useEffect(() => {
    if (apiClient.config) {
      apiClient.config.onTokenRefresh = refreshToken;
      apiClient.config.onAuthError = logout;
    }
  }, [apiClient, refreshToken, logout]);

  // 初始化
  useEffect(() => {
    initializeAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...authState,
    login,
    logout,
    refreshToken,
    fetchUserProfile,
    updateUser,
    hasPermission,
    initializeAuth
  };
}

/**
 * 认证守卫组件
 */
export const AuthGuard: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  isAuthenticated: boolean;
  requiredPermission?: string;
  hasPermission?: (permission: string) => boolean;
}> = ({ children, fallback, isAuthenticated, requiredPermission, hasPermission }) => {
  // 检查认证状态
  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  // 检查权限
  if (requiredPermission && hasPermission && !hasPermission(requiredPermission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
/**
 * 移动端仪表板组件
 * 基于桌面端 Dashboard.vue 的移动端 React 实现
 */

import React, { useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  RefreshControl, 
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useApiData } from '../../shared/hooks/useApiData';
import { useSmartRefresh, pageRefreshConfig } from '../../shared/hooks/useSmartRefresh';
import { createDashboardService } from '../../shared/api/dashboard.service';
import type { DashboardOverview, SystemStatus } from '../../shared/types/api.types';

interface DashboardProps {
  apiClient: any; // API 客户端实例
}

/**
 * 统计卡片组件
 */
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: string;
}> = ({ title, value, subtitle, icon, color = '#1890ff' }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    {icon && (
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Text style={[styles.statIconText, { color }]}>{icon}</Text>
      </View>
    )}
    <View style={styles.statInfo}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  </View>
);

/**
 * 移动端仪表板组件
 */
export const MobileDashboard: React.FC<DashboardProps> = ({ apiClient }) => {
  // 创建仪表板服务
  const dashboardService = useMemo(
    () => createDashboardService(apiClient),
    [apiClient]
  );

  // 获取概览数据
  const overviewData = useApiData<DashboardOverview>({
    apiCall: () => dashboardService.getOverview(),
    fetchOnMount: true,
    polling: true,
    pollingInterval: pageRefreshConfig.dashboard.interval
  });

  // 获取状态数据
  const statusData = useApiData<SystemStatus>({
    apiCall: () => dashboardService.getStatus(),
    fetchOnMount: true,
    polling: true,
    pollingInterval: pageRefreshConfig.dashboard.interval
  });

  // 智能刷新
  const { refresh, loading: refreshing } = useSmartRefresh({
    fetchFn: async () => {
      await Promise.all([
        overviewData.refetch(),
        statusData.refetch()
      ]);
    },
    key: 'dashboard',
    autoRefresh: pageRefreshConfig.dashboard.autoRefresh,
    interval: pageRefreshConfig.dashboard.interval,
    events: pageRefreshConfig.dashboard.events
  });

  // 处理下拉刷新
  const handleRefresh = async () => {
    await refresh(true);
  };

  const overview = overviewData.data;
  const status = statusData.data;
  const loading = overviewData.loading || statusData.loading;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={['#1890ff']}
        />
      }
    >
      {/* 标题栏 */}
      <View style={styles.header}>
        <Text style={styles.title}>钉钉提醒系统</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <Text style={styles.refreshButtonText}>
            {refreshing ? '刷新中...' : '刷新'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 加载指示器 */}
      {loading && !overview && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1890ff" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      )}

      {/* 统计卡片 */}
      {overview && (
        <View style={styles.statsContainer}>
          <StatCard
            title="任务总数"
            value={overview.tasks?.total || 0}
            subtitle={`活跃: ${overview.tasks?.active || 0} | 暂停: ${overview.tasks?.inactive || 0}`}
            icon="📋"
            color="#52c41a"
          />

          <StatCard
            title="群组总数"
            value={overview.groups?.total || 0}
            subtitle={`活跃: ${overview.groups?.active || 0}`}
            icon="👥"
            color="#1890ff"
          />

          <StatCard
            title="今日执行"
            value={status?.execution?.todayExecuted || 0}
            subtitle={`待执行: ${status?.execution?.pending || 0}`}
            icon="📅"
            color="#faad14"
          />

          <StatCard
            title="系统状态"
            value={status?.scheduler?.running ? '运行中' : '已停止'}
            subtitle={`作业数: ${status?.scheduler?.jobs || 0}`}
            icon="⚙️"
            color={status?.scheduler?.running ? '#52c41a' : '#ff4d4f'}
          />
        </View>
      )}

      {/* 错误信息 */}
      {(overviewData.error || statusData.error) && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {overviewData.error?.message || statusData.error?.message || '加载失败'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

/**
 * 样式定义
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333'
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1890ff',
    borderRadius: 4
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14
  },
  statsContainer: {
    padding: 16
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  statIconText: {
    fontSize: 24
  },
  statInfo: {
    flex: 1
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  statSubtitle: {
    fontSize: 12,
    color: '#999'
  },
  errorContainer: {
    padding: 16,
    margin: 16,
    backgroundColor: '#fff2f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffccc7'
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 14,
    marginBottom: 8
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff4d4f',
    borderRadius: 4
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14
  }
});

export default MobileDashboard;
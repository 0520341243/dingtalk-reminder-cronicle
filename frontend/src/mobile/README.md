# 移动端集成指南

## 📋 概述

本指南说明如何在移动端项目中集成共享层代码，实现与桌面端功能一致的移动端应用。

## 🏗️ 架构说明

### 整体架构
```
src/
├── desktop/          # 桌面端代码（Vue 3）- 保持不变
├── shared/           # 跨平台共享层（TypeScript）
│   ├── api/         # API 服务层
│   ├── hooks/       # 通用 React Hooks
│   ├── types/       # TypeScript 类型定义
│   └── utils/       # 工具函数
└── mobile/          # 移动端代码（React/React Native）
    ├── adapters/    # 平台适配器
    ├── components/  # 移动端组件
    └── hooks/       # 移动端特有 Hooks
```

### 核心设计理念
1. **零修改原则**：桌面端代码完全不动，所有移动端功能通过新建文件实现
2. **代码复用**：通过共享层最大化代码复用，减少重复开发
3. **平台适配**：通过适配器模式处理不同平台的差异
4. **统一接口**：API 调用、错误处理、状态管理保持一致

## 🚀 快速开始

### 1. 安装依赖

#### React Native 项目
```bash
npm install react react-native
npm install --save-dev typescript @types/react @types/react-native
```

#### 移动端 Web 项目（React）
```bash
npm install react react-dom
npm install --save-dev typescript @types/react @types/react-dom
```

### 2. 配置 TypeScript

创建或更新 `tsconfig.json`：
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "dom"],
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": "./src",
    "paths": {
      "@shared/*": ["shared/*"],
      "@mobile/*": ["mobile/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. 初始化 API 客户端

```typescript
import { createMobileApiClient } from '@mobile/adapters/api-client.adapter';
import { createDashboardService } from '@shared/api/dashboard.service';

// 创建 API 客户端
const apiClient = createMobileApiClient({
  baseURL: 'http://your-api-server.com/api',
  timeout: 30000,
  onTokenRefresh: async () => {
    // 实现 Token 刷新逻辑
    return { accessToken: 'new-token', refreshToken: 'new-refresh-token' };
  },
  onAuthError: () => {
    // 处理认证错误（如跳转到登录页）
    navigation.navigate('Login');
  }
});

// 创建服务实例
const dashboardService = createDashboardService(apiClient);
```

## 📱 使用示例

### 基础示例：仪表板组件

```tsx
import React from 'react';
import { MobileDashboard } from '@mobile/components/Dashboard';
import { createMobileApiClient } from '@mobile/adapters/api-client.adapter';

const App: React.FC = () => {
  const apiClient = createMobileApiClient();
  
  return (
    <MobileDashboard apiClient={apiClient} />
  );
};

export default App;
```

### 高级示例：完整应用结构

```tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useMobileAuth } from '@mobile/hooks/useMobileAuth';
import { createMobileApiClient } from '@mobile/adapters/api-client.adapter';

const Stack = createStackNavigator();
const apiClient = createMobileApiClient();

const App: React.FC = () => {
  const auth = useMobileAuth({
    apiClient,
    onAuthSuccess: (user) => {
      console.log('登录成功:', user);
    },
    onAuthError: (error) => {
      console.error('认证错误:', error);
    }
  });

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {auth.isAuthenticated ? (
          <>
            <Stack.Screen name="Dashboard">
              {(props) => <MobileDashboard {...props} apiClient={apiClient} />}
            </Stack.Screen>
            {/* 其他已认证页面 */}
          </>
        ) : (
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} onLogin={auth.login} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

### 使用共享 Hooks

```tsx
import React from 'react';
import { View, Text, Button } from 'react-native';
import { useApiData } from '@shared/hooks/useApiData';
import { useSmartRefresh } from '@shared/hooks/useSmartRefresh';

const TaskList: React.FC = ({ apiClient }) => {
  // 使用通用数据获取 Hook
  const { data, loading, error, refetch } = useApiData({
    apiCall: () => apiClient.get('/mongo/tasks'),
    fetchOnMount: true,
    polling: true,
    pollingInterval: 30000
  });

  // 使用智能刷新 Hook
  const { refresh } = useSmartRefresh({
    fetchFn: refetch,
    key: 'tasks',
    autoRefresh: true,
    events: ['task:created', 'task:updated', 'task:deleted']
  });

  if (loading) return <Text>加载中...</Text>;
  if (error) return <Text>错误: {error.message}</Text>;

  return (
    <View>
      <Button title="刷新" onPress={() => refresh(true)} />
      {data?.map(task => (
        <Text key={task.id}>{task.name}</Text>
      ))}
    </View>
  );
};
```

## 🔧 平台适配

### React Native 特有配置

#### AsyncStorage Token 管理
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

class ReactNativeApiClient extends MobileApiClient {
  protected async getStoredToken(): Promise<string | null> {
    return await AsyncStorage.getItem('token');
  }

  protected async setStoredToken(token: string): Promise<void> {
    await AsyncStorage.setItem('token', token);
  }
}
```

#### 网络请求配置
```typescript
// 处理 React Native 的网络请求特殊需求
const apiClient = createMobileApiClient({
  baseURL: __DEV__ 
    ? 'http://10.0.2.2:3000/api' // Android 模拟器
    : 'https://api.production.com/api',
  // React Native 不需要 CSRF Token
  headers: {
    'X-Platform': 'mobile-app'
  }
});
```

### 移动端 Web 特有配置

#### 响应式设计
```typescript
// 使用 CSS-in-JS 或 styled-components 实现响应式
import styled from 'styled-components';

const Container = styled.div`
  padding: 16px;
  
  @media (max-width: 768px) {
    padding: 8px;
  }
`;
```

#### PWA 支持
```typescript
// 添加 Service Worker 支持离线访问
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

## 🧪 测试建议

### 单元测试
```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useApiData } from '@shared/hooks/useApiData';

describe('useApiData', () => {
  it('should fetch data on mount', async () => {
    const mockApiCall = jest.fn().mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Test' }
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useApiData({ apiCall: mockApiCall })
    );

    expect(result.current.loading).toBe(true);
    
    await waitForNextUpdate();
    
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ id: 1, name: 'Test' });
  });
});
```

### 集成测试
```typescript
import { render, waitFor } from '@testing-library/react-native';
import { MobileDashboard } from '@mobile/components/Dashboard';

describe('MobileDashboard', () => {
  it('should display dashboard data', async () => {
    const mockApiClient = createMockApiClient();
    
    const { getByText } = render(
      <MobileDashboard apiClient={mockApiClient} />
    );

    await waitFor(() => {
      expect(getByText('任务总数')).toBeTruthy();
      expect(getByText('10')).toBeTruthy(); // 假设返回的任务总数是 10
    });
  });
});
```

## 📦 构建和部署

### React Native 构建

#### iOS
```bash
cd ios && pod install
npx react-native run-ios --configuration Release
```

#### Android
```bash
cd android && ./gradlew assembleRelease
```

### 移动端 Web 构建
```bash
npm run build
# 输出到 dist/ 目录，可部署到任何静态服务器
```

## 🔒 安全考虑

1. **Token 安全存储**
   - React Native: 使用 Keychain (iOS) / Keystore (Android)
   - Web: 使用 httpOnly cookies 或加密的 localStorage

2. **API 通信安全**
   - 强制使用 HTTPS
   - 实现证书固定（Certificate Pinning）
   - 添加请求签名机制

3. **代码混淆**
   - React Native: 使用 Hermes 引擎和 ProGuard
   - Web: 使用 Webpack 的生产模式

## 📊 性能优化

1. **列表虚拟化**
```tsx
import { FlatList } from 'react-native';

<FlatList
  data={largeDataSet}
  renderItem={renderItem}
  keyExtractor={item => item.id}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={10}
/>
```

2. **图片优化**
```tsx
import FastImage from 'react-native-fast-image';

<FastImage
  source={{ uri: imageUrl }}
  style={styles.image}
  resizeMode={FastImage.resizeMode.contain}
/>
```

3. **缓存策略**
```typescript
const cachedApiClient = createMobileApiClient({
  // 启用缓存
  cache: {
    enabled: true,
    ttl: 300000, // 5 分钟
    storage: AsyncStorage
  }
});
```

## 🚨 常见问题

### Q: 如何处理不同屏幕尺寸？
A: 使用响应式设计和百分比布局，配合 `Dimensions` API 动态计算。

### Q: 如何实现离线功能？
A: 使用 Redux Persist 或 AsyncStorage 缓存数据，配合乐观更新策略。

### Q: 如何处理深层链接？
A: React Native 使用 React Navigation 的深层链接配置，Web 使用 React Router。

## 📚 相关资源

- [React Native 文档](https://reactnative.dev/)
- [React 文档](https://react.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [项目 API 文档](../../../CLAUDE.md)
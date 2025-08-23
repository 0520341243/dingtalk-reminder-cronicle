/**
 * 平台检测和适配工具
 * 提供跨平台的环境检测和适配功能
 */

/**
 * 平台类型枚举
 */
export enum Platform {
  WEB = 'web',
  IOS = 'ios',
  ANDROID = 'android',
  WINDOWS = 'windows',
  MACOS = 'macos',
  LINUX = 'linux',
  UNKNOWN = 'unknown'
}

/**
 * 设备类型枚举
 */
export enum DeviceType {
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop',
  TV = 'tv',
  UNKNOWN = 'unknown'
}

/**
 * 浏览器类型枚举
 */
export enum BrowserType {
  CHROME = 'chrome',
  FIREFOX = 'firefox',
  SAFARI = 'safari',
  EDGE = 'edge',
  OPERA = 'opera',
  IE = 'ie',
  UNKNOWN = 'unknown'
}

/**
 * 平台检测工具类
 */
export class PlatformDetector {
  private static instance: PlatformDetector;
  private userAgent: string = '';
  private platform: Platform = Platform.UNKNOWN;
  private deviceType: DeviceType = DeviceType.UNKNOWN;
  private browserType: BrowserType = BrowserType.UNKNOWN;

  private constructor() {
    this.initialize();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): PlatformDetector {
    if (!PlatformDetector.instance) {
      PlatformDetector.instance = new PlatformDetector();
    }
    return PlatformDetector.instance;
  }

  /**
   * 初始化平台检测
   */
  private initialize(): void {
    // React Native 环境
    if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
      this.detectReactNativePlatform();
      return;
    }

    // Web 环境
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      this.userAgent = navigator.userAgent.toLowerCase();
      this.detectWebPlatform();
      this.detectBrowser();
      this.detectDeviceType();
      return;
    }

    // Node.js 环境
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      this.detectNodePlatform();
      return;
    }
  }

  /**
   * 检测 React Native 平台
   */
  private detectReactNativePlatform(): void {
    // 需要从 React Native 的 Platform API 获取
    // import { Platform } from 'react-native';
    // this.platform = Platform.OS === 'ios' ? Platform.IOS : Platform.ANDROID;
    this.deviceType = DeviceType.MOBILE;
  }

  /**
   * 检测 Web 平台
   */
  private detectWebPlatform(): void {
    this.platform = Platform.WEB;

    // 检测操作系统
    if (this.userAgent.includes('mac')) {
      this.platform = Platform.MACOS;
    } else if (this.userAgent.includes('win')) {
      this.platform = Platform.WINDOWS;
    } else if (this.userAgent.includes('linux')) {
      this.platform = Platform.LINUX;
    } else if (this.userAgent.includes('android')) {
      this.platform = Platform.ANDROID;
    } else if (this.userAgent.includes('iphone') || this.userAgent.includes('ipad')) {
      this.platform = Platform.IOS;
    }
  }

  /**
   * 检测浏览器类型
   */
  private detectBrowser(): void {
    if (this.userAgent.includes('chrome') && !this.userAgent.includes('edg')) {
      this.browserType = BrowserType.CHROME;
    } else if (this.userAgent.includes('firefox')) {
      this.browserType = BrowserType.FIREFOX;
    } else if (this.userAgent.includes('safari') && !this.userAgent.includes('chrome')) {
      this.browserType = BrowserType.SAFARI;
    } else if (this.userAgent.includes('edg')) {
      this.browserType = BrowserType.EDGE;
    } else if (this.userAgent.includes('opera') || this.userAgent.includes('opr')) {
      this.browserType = BrowserType.OPERA;
    } else if (this.userAgent.includes('msie') || this.userAgent.includes('trident')) {
      this.browserType = BrowserType.IE;
    }
  }

  /**
   * 检测设备类型
   */
  private detectDeviceType(): void {
    // 检测移动设备
    if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(this.userAgent)) {
      this.deviceType = DeviceType.MOBILE;
      return;
    }

    // 检测平板
    if (/ipad|tablet|playbook|silk/i.test(this.userAgent)) {
      this.deviceType = DeviceType.TABLET;
      return;
    }

    // 检测电视
    if (/smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast/i.test(this.userAgent)) {
      this.deviceType = DeviceType.TV;
      return;
    }

    // 默认为桌面设备
    this.deviceType = DeviceType.DESKTOP;
  }

  /**
   * 检测 Node.js 平台
   */
  private detectNodePlatform(): void {
    const platform = process.platform;
    
    switch (platform) {
      case 'darwin':
        this.platform = Platform.MACOS;
        break;
      case 'win32':
        this.platform = Platform.WINDOWS;
        break;
      case 'linux':
        this.platform = Platform.LINUX;
        break;
      default:
        this.platform = Platform.UNKNOWN;
    }

    this.deviceType = DeviceType.DESKTOP;
  }

  // Getter 方法
  getPlatform(): Platform {
    return this.platform;
  }

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getBrowserType(): BrowserType {
    return this.browserType;
  }

  getUserAgent(): string {
    return this.userAgent;
  }

  // 便捷检测方法
  isMobile(): boolean {
    return this.deviceType === DeviceType.MOBILE;
  }

  isTablet(): boolean {
    return this.deviceType === DeviceType.TABLET;
  }

  isDesktop(): boolean {
    return this.deviceType === DeviceType.DESKTOP;
  }

  isWeb(): boolean {
    return this.platform === Platform.WEB || 
           (typeof window !== 'undefined' && typeof document !== 'undefined');
  }

  isReactNative(): boolean {
    return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
  }

  isIOS(): boolean {
    return this.platform === Platform.IOS;
  }

  isAndroid(): boolean {
    return this.platform === Platform.ANDROID;
  }

  isTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 ||
           (navigator as any).msMaxTouchPoints > 0;
  }

  /**
   * 获取屏幕尺寸
   */
  getScreenSize(): { width: number; height: number } | null {
    if (typeof window === 'undefined') return null;
    
    return {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight
    };
  }

  /**
   * 获取设备像素比
   */
  getDevicePixelRatio(): number {
    return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  }

  /**
   * 检测是否支持某个功能
   */
  supports(feature: string): boolean {
    switch (feature) {
      case 'localStorage':
        return typeof localStorage !== 'undefined';
      case 'sessionStorage':
        return typeof sessionStorage !== 'undefined';
      case 'indexedDB':
        return typeof indexedDB !== 'undefined';
      case 'webWorker':
        return typeof Worker !== 'undefined';
      case 'serviceWorker':
        return 'serviceWorker' in navigator;
      case 'notification':
        return 'Notification' in window;
      case 'geolocation':
        return 'geolocation' in navigator;
      case 'camera':
        return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
      case 'webgl':
        try {
          const canvas = document.createElement('canvas');
          return !!(window.WebGLRenderingContext && 
                   (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
          return false;
        }
      default:
        return false;
    }
  }
}

// 导出单例实例
export const platformDetector = PlatformDetector.getInstance();

/**
 * 平台适配工具函数
 */
export const PlatformUtils = {
  /**
   * 根据平台选择值
   */
  select<T>(options: Partial<Record<Platform | DeviceType, T>>, defaultValue: T): T {
    const detector = PlatformDetector.getInstance();
    
    // 先检查具体平台
    const platform = detector.getPlatform();
    if (platform in options && options[platform] !== undefined) {
      return options[platform]!;
    }
    
    // 再检查设备类型
    const deviceType = detector.getDeviceType();
    if (deviceType in options && options[deviceType] !== undefined) {
      return options[deviceType]!;
    }
    
    return defaultValue;
  },

  /**
   * 获取适配的样式
   */
  getResponsiveValue(
    mobile: number,
    tablet: number,
    desktop: number
  ): number {
    const detector = PlatformDetector.getInstance();
    
    if (detector.isMobile()) return mobile;
    if (detector.isTablet()) return tablet;
    return desktop;
  },

  /**
   * 获取安全区域边距（用于 iOS 刘海屏等）
   */
  getSafeAreaInsets(): {
    top: number;
    bottom: number;
    left: number;
    right: number;
  } {
    // 这里需要根据具体平台实现
    // React Native 可以使用 react-native-safe-area-context
    // Web 可以使用 env(safe-area-inset-*)
    return { top: 0, bottom: 0, left: 0, right: 0 };
  },

  /**
   * 振动反馈（移动端）
   */
  vibrate(pattern: number | number[] = 100): void {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  },

  /**
   * 保持屏幕常亮（移动端）
   */
  async keepScreenOn(enable: boolean): Promise<void> {
    if ('wakeLock' in navigator) {
      try {
        if (enable) {
          await (navigator as any).wakeLock.request('screen');
        } else {
          // 释放 wakeLock
        }
      } catch (error) {
        console.error('Failed to keep screen on:', error);
      }
    }
  }
};

export default platformDetector;
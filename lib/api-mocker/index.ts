/**
 * API Response Mocker - Core Engine
 * Central system for mocking external API responses with Swedish BRF context
 */

import { z } from 'zod';

export interface MockConfig {
  service: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  scenario: string;
  delayMs: number;
  responseStatus: number;
  responseData: Record<string, any>;
  headers?: Record<string, string>;
  isEnabled: boolean;
  environment: 'development' | 'staging' | 'production' | 'test';
  cooperativeId?: string;
}

export interface MockResponse {
  status: number;
  data: Record<string, any>;
  headers: Record<string, string>;
  delay: number;
  timestamp: string;
}

export interface ServiceConfig {
  baseUrl: string;
  defaultHeaders: Record<string, string>;
  authentication?: {
    type: 'bearer' | 'api_key' | 'basic' | 'oauth2';
    config: Record<string, any>;
  };
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export class ApiMocker {
  private configs: Map<string, MockConfig> = new Map();
  private services: Map<string, ServiceConfig> = new Map();
  private mockHistory: Array<{
    configId: string;
    request: Record<string, any>;
    response: MockResponse;
    timestamp: string;
  }> = [];

  constructor() {
    this.initializeSwedishServices();
  }

  /**
   * Initialize Swedish BRF-specific services
   */
  private initializeSwedishServices(): void {
    // BankID Configuration
    this.services.set('bankid', {
      baseUrl: 'https://appapi2.test.bankid.com/rp/v6.0',
      defaultHeaders: {
        'Content-Type': 'application/json',
        'User-Agent': 'BRF-Portal/1.0',
      },
      authentication: {
        type: 'basic',
        config: {
          username: 'test_client',
          password: 'test_password',
        },
      },
      rateLimit: {
        requests: 100,
        windowMs: 60000, // 1 minute
      },
    });

    // Fortnox Configuration
    this.services.set('fortnox', {
      baseUrl: 'https://api.fortnox.se/3',
      defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      authentication: {
        type: 'bearer',
        config: {
          tokenUrl: 'https://apps.fortnox.se/oauth-v1/token',
          scope: 'invoice customer article voucher',
        },
      },
      rateLimit: {
        requests: 25,
        windowMs: 5000, // 5 seconds (Fortnox rate limit)
      },
    });

    // Kivra Configuration
    this.services.set('kivra', {
      baseUrl: 'https://api.kivra.com/v2',
      defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      authentication: {
        type: 'oauth2',
        config: {
          tokenUrl: 'https://api.kivra.com/oauth/token',
          scope: 'send_message delivery_receipt',
        },
      },
      rateLimit: {
        requests: 1000,
        windowMs: 60000, // 1 minute
      },
    });

    // Swedish Banks Configuration (Generic)
    this.services.set('swedish_banks', {
      baseUrl: 'https://psd2.api.swedbank.se/v1',
      defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-ID': 'auto-generated',
      },
      authentication: {
        type: 'oauth2',
        config: {
          tokenUrl: 'https://psd2.api.swedbank.se/oauth/token',
          scope: 'payment-initiation account-information',
        },
      },
      rateLimit: {
        requests: 100,
        windowMs: 60000, // 1 minute
      },
    });

    // Autogiro (Swedish Direct Debit) Configuration
    this.services.set('autogiro', {
      baseUrl: 'https://api.bankgirot.se/v1',
      defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      authentication: {
        type: 'api_key',
        config: {
          keyHeader: 'X-API-Key',
          keyLocation: 'header',
        },
      },
      rateLimit: {
        requests: 50,
        windowMs: 60000, // 1 minute
      },
    });

    // Swish Configuration
    this.services.set('swish', {
      baseUrl: 'https://mss.cpc.getswish.net/swish-cpcapi/api/v2',
      defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      authentication: {
        type: 'bearer',
        config: {
          certificateRequired: true,
        },
      },
      rateLimit: {
        requests: 300,
        windowMs: 60000, // 1 minute
      },
    });
  }

  /**
   * Register a new mock configuration
   */
  registerMock(config: MockConfig): string {
    const configId = this.generateConfigId(config);
    this.configs.set(configId, config);
    return configId;
  }

  /**
   * Generate a unique configuration ID
   */
  private generateConfigId(config: MockConfig): string {
    const parts = [
      config.service,
      config.method,
      config.endpoint.replace(/[^a-zA-Z0-9]/g, '_'),
      config.scenario,
    ];
    return parts.join('_').toLowerCase();
  }

  /**
   * Get mock response for a request
   */
  async getMockResponse(
    service: string,
    endpoint: string,
    method: string,
    scenario: string = 'default',
    cooperativeId?: string
  ): Promise<MockResponse | null> {
    const configId = this.generateConfigId({
      service,
      endpoint,
      method: method as MockConfig['method'],
      scenario,
    } as MockConfig);

    const config = this.configs.get(configId);
    if (!config || !config.isEnabled) {
      return null;
    }

    // Apply delay if configured
    if (config.delayMs > 0) {
      await this.delay(config.delayMs);
    }

    const response: MockResponse = {
      status: config.responseStatus,
      data: config.responseData,
      headers: {
        'Content-Type': 'application/json',
        'X-Mock-Service': service,
        'X-Mock-Scenario': scenario,
        'X-Mock-Timestamp': new Date().toISOString(),
        ...config.headers,
      },
      delay: config.delayMs,
      timestamp: new Date().toISOString(),
    };

    // Record in history
    this.mockHistory.push({
      configId,
      request: { service, endpoint, method, scenario, cooperativeId },
      response,
      timestamp: new Date().toISOString(),
    });

    // Limit history size
    if (this.mockHistory.length > 1000) {
      this.mockHistory = this.mockHistory.slice(-500);
    }

    return response;
  }

  /**
   * Get all registered mock configurations
   */
  getMockConfigs(): MockConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get mock configuration by ID
   */
  getMockConfig(configId: string): MockConfig | undefined {
    return this.configs.get(configId);
  }

  /**
   * Update mock configuration
   */
  updateMockConfig(configId: string, updates: Partial<MockConfig>): boolean {
    const existing = this.configs.get(configId);
    if (!existing) {
      return false;
    }

    const updated = { ...existing, ...updates };
    this.configs.set(configId, updated);
    return true;
  }

  /**
   * Delete mock configuration
   */
  deleteMockConfig(configId: string): boolean {
    return this.configs.delete(configId);
  }

  /**
   * Get service configuration
   */
  getServiceConfig(service: string): ServiceConfig | undefined {
    return this.services.get(service);
  }

  /**
   * Get all service configurations
   */
  getServiceConfigs(): Record<string, ServiceConfig> {
    return Object.fromEntries(this.services.entries());
  }

  /**
   * Get mock history
   */
  getMockHistory(limit: number = 100): Array<{
    configId: string;
    request: Record<string, any>;
    response: MockResponse;
    timestamp: string;
  }> {
    return this.mockHistory.slice(-limit);
  }

  /**
   * Clear mock history
   */
  clearHistory(): void {
    this.mockHistory = [];
  }

  /**
   * Enable/disable mock configuration
   */
  toggleMockConfig(configId: string, enabled: boolean): boolean {
    const config = this.configs.get(configId);
    if (!config) {
      return false;
    }

    config.isEnabled = enabled;
    return true;
  }

  /**
   * Get available scenarios for a service
   */
  getServiceScenarios(service: string): string[] {
    const scenarios = new Set<string>();
    
    for (const config of this.configs.values()) {
      if (config.service === service) {
        scenarios.add(config.scenario);
      }
    }

    return Array.from(scenarios);
  }

  /**
   * Import mock configurations from JSON
   */
  importConfigs(configs: MockConfig[]): number {
    let imported = 0;
    
    for (const config of configs) {
      try {
        const configId = this.registerMock(config);
        if (configId) {
          imported++;
        }
      } catch (error) {
        console.warn('Failed to import config:', config, error);
      }
    }

    return imported;
  }

  /**
   * Export mock configurations to JSON
   */
  exportConfigs(): MockConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Utility: Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate realistic Swedish personal number for testing
   */
  generateSwedishPersonalNumber(): string {
    const year = Math.floor(Math.random() * 50) + 1950; // 1950-1999
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    const last4 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    
    return `${year}${month}${day}${last4}`;
  }

  /**
   * Generate realistic Swedish organization number for BRF
   */
  generateSwedishOrgNumber(): string {
    // Format: XXXXXX-XXXX where first digit of last 4 is always 5-9 for organizations
    const first6 = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    const orgDigit = Math.floor(Math.random() * 5) + 5; // 5-9
    const last3 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    
    return `${first6}-${orgDigit}${last3}`;
  }

  /**
   * Generate realistic Swedish postal code
   */
  generateSwedishPostalCode(): string {
    const first3 = String(Math.floor(Math.random() * 900) + 100); // 100-999
    const last2 = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    
    return `${first3} ${last2}`;
  }

  /**
   * Generate realistic Swedish phone number
   */
  generateSwedishPhoneNumber(): string {
    const areaCode = ['08', '031', '040', '046', '054', '060', '063', '070', '072', '073', '076'];
    const area = areaCode[Math.floor(Math.random() * areaCode.length)];
    const number = String(Math.floor(Math.random() * 10000000)).padStart(7, '0');
    
    return `${area}-${number.substring(0, 3)} ${number.substring(3, 5)} ${number.substring(5)}`;
  }
}

// Export singleton instance
export const apiMocker = new ApiMocker();

// Export validation schemas
export const MockConfigSchema = z.object({
  service: z.string().min(1),
  endpoint: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  scenario: z.string().min(1),
  delayMs: z.number().min(0).max(30000), // Max 30 seconds
  responseStatus: z.number().min(100).max(599),
  responseData: z.record(z.any()),
  headers: z.record(z.string()).optional(),
  isEnabled: z.boolean(),
  environment: z.enum(['development', 'staging', 'production', 'test']),
  cooperativeId: z.string().optional(),
});

export const ServiceConfigSchema = z.object({
  baseUrl: z.string().url(),
  defaultHeaders: z.record(z.string()),
  authentication: z.object({
    type: z.enum(['bearer', 'api_key', 'basic', 'oauth2']),
    config: z.record(z.any()),
  }).optional(),
  rateLimit: z.object({
    requests: z.number().positive(),
    windowMs: z.number().positive(),
  }).optional(),
});
/**
 * Service Adapter - Integration hooks for switching between mock and real services
 * Provides seamless switching between mock responses and real API calls
 */

import { apiMocker, MockResponse } from './index';

export interface ServiceAdapterConfig {
  useMocks: boolean;
  environment: 'development' | 'staging' | 'production' | 'test';
  cooperativeId: string;
  fallbackToReal?: boolean; // If mock fails, use real service
  mockOverrides?: Record<string, boolean>; // Per-service mock overrides
}

export interface ApiRequest {
  service: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  scenario?: string;
}

export interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, string>;
  isMocked: boolean;
  responseTime: number;
  timestamp: string;
}

export class ServiceAdapter {
  private config: ServiceAdapterConfig;

  constructor(config: ServiceAdapterConfig) {
    this.config = config;
  }

  /**
   * Execute API request with mock/real service switching
   */
  async request<T = any>(request: ApiRequest): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    
    // Determine if we should use mock for this request
    const shouldUseMock = this.shouldUseMock(request.service);
    
    if (shouldUseMock) {
      try {
        const mockResponse = await this.getMockResponse(request);
        if (mockResponse) {
          return {
            status: mockResponse.status,
            data: mockResponse.data,
            headers: mockResponse.headers,
            isMocked: true,
            responseTime: Date.now() - startTime,
            timestamp: mockResponse.timestamp,
          };
        }
      } catch (error) {
        console.warn(`Mock request failed for ${request.service}:`, error);
        
        // If fallback is enabled, continue to real service
        if (!this.config.fallbackToReal) {
          throw error;
        }
      }
    }

    // Use real service
    const realResponse = await this.executeRealRequest<T>(request);
    return {
      ...realResponse,
      isMocked: false,
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Determine if mock should be used for a service
   */
  private shouldUseMock(service: string): boolean {
    // Check service-specific override
    if (this.config.mockOverrides && service in this.config.mockOverrides) {
      return this.config.mockOverrides[service];
    }
    
    // Use global setting
    return this.config.useMocks;
  }

  /**
   * Get mock response from the API mocker
   */
  private async getMockResponse(request: ApiRequest): Promise<MockResponse | null> {
    return await apiMocker.getMockResponse(
      request.service,
      request.endpoint,
      request.method,
      request.scenario || 'default',
      this.config.cooperativeId
    );
  }

  /**
   * Execute real API request
   */
  private async executeRealRequest<T>(request: ApiRequest): Promise<Omit<ApiResponse<T>, 'isMocked' | 'responseTime' | 'timestamp'>> {
    const serviceConfig = apiMocker.getServiceConfig(request.service);
    if (!serviceConfig) {
      throw new Error(`Service configuration not found: ${request.service}`);
    }

    const url = this.buildUrl(serviceConfig.baseUrl, request.endpoint, request.params);
    const headers = {
      ...serviceConfig.defaultHeaders,
      ...request.headers,
    };

    // Add authentication if configured
    if (serviceConfig.authentication) {
      this.addAuthentication(headers, serviceConfig.authentication);
    }

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    if (request.data && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      fetchOptions.body = JSON.stringify(request.data);
    }

    const response = await fetch(url, fetchOptions);
    const responseData = await response.json();

    return {
      status: response.status,
      data: responseData,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  /**
   * Build URL with parameters
   */
  private buildUrl(baseUrl: string, endpoint: string, params?: Record<string, string>): string {
    let url = `${baseUrl}${endpoint}`;
    
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    
    return url;
  }

  /**
   * Add authentication to headers
   */
  private addAuthentication(headers: Record<string, string>, auth: any): void {
    switch (auth.type) {
      case 'bearer':
        if (auth.config.token) {
          headers['Authorization'] = `Bearer ${auth.config.token}`;
        }
        break;
        
      case 'api_key':
        if (auth.config.keyHeader && auth.config.key) {
          headers[auth.config.keyHeader] = auth.config.key;
        }
        break;
        
      case 'basic':
        if (auth.config.username && auth.config.password) {
          const credentials = btoa(`${auth.config.username}:${auth.config.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
    }
  }

  /**
   * Update adapter configuration
   */
  updateConfig(updates: Partial<ServiceAdapterConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Enable/disable mocks for a specific service
   */
  setServiceMockEnabled(service: string, enabled: boolean): void {
    if (!this.config.mockOverrides) {
      this.config.mockOverrides = {};
    }
    this.config.mockOverrides[service] = enabled;
  }

  /**
   * Get current configuration
   */
  getConfig(): ServiceAdapterConfig {
    return { ...this.config };
  }
}

/**
 * Specialized adapters for Swedish BRF services
 */

export class BankIDAdapter extends ServiceAdapter {
  constructor(config: ServiceAdapterConfig) {
    super(config);
  }

  async authenticate(personalNumber: string, scenario: string = 'success'): Promise<ApiResponse> {
    return await this.request({
      service: 'bankid',
      endpoint: '/auth',
      method: 'POST',
      scenario,
      data: {
        personalNumber,
        endUserIp: '192.168.1.1',
        requirement: {
          allowFingerprint: true,
        },
      },
    });
  }

  async collect(orderRef: string, scenario: string = 'complete'): Promise<ApiResponse> {
    return await this.request({
      service: 'bankid',
      endpoint: '/collect',
      method: 'POST',
      scenario,
      data: {
        orderRef,
      },
    });
  }

  async cancel(orderRef: string): Promise<ApiResponse> {
    return await this.request({
      service: 'bankid',
      endpoint: '/cancel',
      method: 'POST',
      scenario: 'cancelled',
      data: {
        orderRef,
      },
    });
  }
}

export class FortnoxAdapter extends ServiceAdapter {
  constructor(config: ServiceAdapterConfig) {
    super(config);
  }

  async createInvoice(invoiceData: any, scenario: string = 'invoice_created'): Promise<ApiResponse> {
    return await this.request({
      service: 'fortnox',
      endpoint: '/invoices',
      method: 'POST',
      scenario,
      data: {
        Invoice: invoiceData,
      },
    });
  }

  async getInvoice(invoiceNumber: string, scenario: string = 'success'): Promise<ApiResponse> {
    return await this.request({
      service: 'fortnox',
      endpoint: `/invoices/${invoiceNumber}`,
      method: 'GET',
      scenario,
    });
  }

  async createCustomer(customerData: any, scenario: string = 'customer_created'): Promise<ApiResponse> {
    return await this.request({
      service: 'fortnox',
      endpoint: '/customers',
      method: 'POST',
      scenario,
      data: {
        Customer: customerData,
      },
    });
  }
}

export class KivraAdapter extends ServiceAdapter {
  constructor(config: ServiceAdapterConfig) {
    super(config);
  }

  async sendMessage(messageData: any, scenario: string = 'message_delivered'): Promise<ApiResponse> {
    return await this.request({
      service: 'kivra',
      endpoint: '/messages',
      method: 'POST',
      scenario,
      data: messageData,
    });
  }

  async getDeliveryStatus(messageId: string, scenario: string = 'delivered'): Promise<ApiResponse> {
    return await this.request({
      service: 'kivra',
      endpoint: `/messages/${messageId}/status`,
      method: 'GET',
      scenario,
    });
  }
}

export class SwedishBankAdapter extends ServiceAdapter {
  constructor(config: ServiceAdapterConfig) {
    super(config);
  }

  async initiatePayment(paymentData: any, scenario: string = 'payment_completed'): Promise<ApiResponse> {
    return await this.request({
      service: 'swedish_banks',
      endpoint: '/payment-requests',
      method: 'POST',
      scenario,
      data: paymentData,
    });
  }

  async getAccountBalance(accountId: string, scenario: string = 'account_balance_check'): Promise<ApiResponse> {
    return await this.request({
      service: 'swedish_banks',
      endpoint: `/accounts/${accountId}/balance`,
      method: 'GET',
      scenario,
    });
  }

  async getTransactionHistory(accountId: string, fromDate: string, toDate: string, scenario: string = 'transaction_history'): Promise<ApiResponse> {
    return await this.request({
      service: 'swedish_banks',
      endpoint: `/accounts/${accountId}/transactions`,
      method: 'GET',
      scenario,
      params: {
        fromDate,
        toDate,
        limit: '50',
      },
    });
  }

  async setupAutogiro(mandateData: any, scenario: string = 'direct_debit_setup'): Promise<ApiResponse> {
    return await this.request({
      service: 'swedish_banks',
      endpoint: '/autogiro/mandates',
      method: 'POST',
      scenario,
      data: mandateData,
    });
  }
}

/**
 * Factory function to create service adapters based on environment
 */
export function createServiceAdapter(
  service: string,
  config: ServiceAdapterConfig
): ServiceAdapter {
  switch (service.toLowerCase()) {
    case 'bankid':
      return new BankIDAdapter(config);
    case 'fortnox':
      return new FortnoxAdapter(config);
    case 'kivra':
      return new KivraAdapter(config);
    case 'swedish_banks':
      return new SwedishBankAdapter(config);
    default:
      return new ServiceAdapter(config);
  }
}

/**
 * Global service adapter manager
 */
export class ServiceAdapterManager {
  private adapters: Map<string, ServiceAdapter> = new Map();
  private globalConfig: ServiceAdapterConfig;

  constructor(globalConfig: ServiceAdapterConfig) {
    this.globalConfig = globalConfig;
  }

  /**
   * Get or create service adapter
   */
  getAdapter(service: string): ServiceAdapter {
    if (!this.adapters.has(service)) {
      const adapter = createServiceAdapter(service, this.globalConfig);
      this.adapters.set(service, adapter);
    }
    return this.adapters.get(service)!;
  }

  /**
   * Update global configuration for all adapters
   */
  updateGlobalConfig(updates: Partial<ServiceAdapterConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...updates };
    
    // Update all existing adapters
    this.adapters.forEach(adapter => {
      adapter.updateConfig(updates);
    });
  }

  /**
   * Enable/disable mocks globally
   */
  setMocksEnabled(enabled: boolean): void {
    this.updateGlobalConfig({ useMocks: enabled });
  }

  /**
   * Enable/disable mocks for specific service
   */
  setServiceMockEnabled(service: string, enabled: boolean): void {
    const adapter = this.getAdapter(service);
    adapter.setServiceMockEnabled(service, enabled);
  }

  /**
   * Get all adapters
   */
  getAllAdapters(): Record<string, ServiceAdapter> {
    return Object.fromEntries(this.adapters.entries());
  }

  /**
   * Clear all adapters (useful for testing)
   */
  clearAdapters(): void {
    this.adapters.clear();
  }
}
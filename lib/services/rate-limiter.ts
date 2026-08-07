import { createServiceRoleClient } from '@/lib/supabase/service-role';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private supabase = createServiceRoleClient();

  private constructor() {}

  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Check rate limit for a specific key
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    try {
      const now = Date.now();
      const windowStart = now - config.windowMs;
      const redisKey = `${config.keyPrefix}:${key}`;

      // For now, we'll use a simple in-memory approach
      // In production, this should use Redis or similar distributed cache
      
      // Get existing count from database (simplified approach)
      const { data: existingLogs } = await this.supabase
        .from('audit_logs')
        .select('created_at')
        .eq('action', 'RATE_LIMIT_CHECK')
        .eq('resource_id', key)
        .gt('created_at', new Date(windowStart).toISOString());

      const currentCount = existingLogs?.length || 0;
      const remaining = Math.max(0, config.maxRequests - currentCount);
      const resetTime = now + config.windowMs;

      // Log this rate limit check
      await this.supabase
        .from('audit_logs')
        .insert({
          action: 'RATE_LIMIT_CHECK',
          resource_type: 'rate_limit',
          resource_id: key,
          metadata: {
            key,
            config,
            currentCount,
            remaining,
            resetTime,
          },
        });

      return {
        allowed: currentCount < config.maxRequests,
        remaining,
        resetTime,
        limit: config.maxRequests,
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
        limit: config.maxRequests,
      };
    }
  }

  /**
   * Check rate limit for IP address
   */
  async checkIpRateLimit(
    ipAddress: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(`ip:${ipAddress}`, config);
  }

  /**
   * Check rate limit for user ID
   */
  async checkUserRateLimit(
    userId: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(`user:${userId}`, config);
  }

  /**
   * Check rate limit for email
   */
  async checkEmailRateLimit(
    email: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(`email:${email}`, config);
  }

  /**
   * Get rate limit configuration for different endpoints
   */
  getEndpointConfig(endpoint: string): RateLimitConfig {
    const configs: Record<string, RateLimitConfig> = {
      // Authentication endpoints - stricter limits
      '/api/auth/access-request': {
        maxRequests: 5,
        windowMs: 15 * 60 * 1000, // 15 minutes
        keyPrefix: 'access_request',
      },
      '/api/auth/sign-in': {
        maxRequests: 10,
        windowMs: 5 * 60 * 1000, // 5 minutes
        keyPrefix: 'sign_in',
      },
      '/api/auth/callback': {
        maxRequests: 20,
        windowMs: 1 * 60 * 1000, // 1 minute
        keyPrefix: 'callback',
      },
      // Admin API endpoints - moderate limits
      '/api/admin/dashboard/stats': {
        maxRequests: 60,
        windowMs: 60 * 1000, // 1 minute
        keyPrefix: 'dashboard_stats',
      },
      '/api/admin/audit-log': {
        maxRequests: 30,
        windowMs: 60 * 1000, // 1 minute
        keyPrefix: 'audit_log',
      },
      // Default configuration
      default: {
        maxRequests: 100,
        windowMs: 60 * 1000, // 1 minute
        keyPrefix: 'default',
      },
    };

    return configs[endpoint] || configs.default;
  }

  /**
   * Apply rate limiting to a request
   */
  async applyRateLimit(
    request: Request,
    endpoint: string
  ): Promise<RateLimitResult> {
    const config = this.getEndpointConfig(endpoint);
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Always apply IP-based rate limiting
    const ipResult = await this.checkIpRateLimit(ipAddress, config);

    if (!ipResult.allowed) {
      return ipResult;
    }

    // For authenticated endpoints, also apply user-based rate limiting
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Extract user ID from token (simplified)
      // In production, you would decode the JWT to get user ID
      const token = authHeader.substring(7);
      // For now, we'll use a simplified approach
      // In real implementation, decode JWT to get user ID
    }

    return ipResult;
  }
}
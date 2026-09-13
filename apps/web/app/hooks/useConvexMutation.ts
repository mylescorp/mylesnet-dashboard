"use client";

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000, onRetry } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      if (attempt === maxRetries) {
        throw error;
      }

      if (onRetry) {
        onRetry(attempt + 1);
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }

  throw new Error("Max retries exceeded");
}
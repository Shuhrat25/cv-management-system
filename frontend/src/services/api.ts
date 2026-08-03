const API_BASE = '/api';

export interface ApiError {
  error: string;
  currentVersion?: number;
  conflicts?: any[];
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorObj: ApiError = {
      error: data.error || `HTTP error ${res.status}`,
      currentVersion: data.currentVersion,
      conflicts: data.conflicts,
    };
    throw errorObj;
  }

  return data as T;
}

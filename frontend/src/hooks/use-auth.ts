'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, type User } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Query keys
export const authKeys = {
  user: ['auth', 'user'] as const,
};

// Hooks
export function useUser() {
  return useQuery({
    queryKey: authKeys.user,
    queryFn: () => authApi.me(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: { email: string; password: string }) => authApi.login(data),
    onSuccess: (response) => {
      // Store token
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth-token', response.data.token);
      }
      // Invalidate and refetch user
      queryClient.invalidateQueries({ queryKey: authKeys.user });
      // Redirect to dashboard
      router.push('/dashboard');
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) => authApi.register(data),
    onSuccess: (response) => {
      // Store token
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth-token', response.data.token);
      }
      // Invalidate and refetch user
      queryClient.invalidateQueries({ queryKey: authKeys.user });
      // Redirect to dashboard
      router.push('/dashboard');
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      authApi.logout();
    },
    onSuccess: () => {
      // Clear all queries
      queryClient.clear();
      // Redirect to login
      router.push('/login');
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name?: string; email?: string }) => authApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.user });
    },
  });
}

// Auth guard hook
export function useAuth(options?: { required?: boolean }) {
  const { required = true } = options || {};
  const router = useRouter();
  const { data, isLoading, error } = useUser();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for token
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;
    
    if (!token && required) {
      router.push('/login');
      return;
    }

    if (token && !isLoading) {
      if (error || !data?.data) {
        // Token is invalid
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-token');
        }
        if (required) {
          router.push('/login');
        }
      } else {
        setIsAuthenticated(true);
      }
    }
  }, [data, isLoading, error, required, router]);

  return {
    user: data?.data,
    isLoading,
    isAuthenticated,
  };
}

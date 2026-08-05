/**
 * The gate in front of every signed-in screen.
 *
 * It asks the Worker whether there is a session rather than reading anything
 * locally, because there is nothing local to read: the session is an HttpOnly
 * cookie, so this app holds no token, and that is the point rather than an
 * inconvenience. The cost is one request on load; the benefit is that a stolen
 * localStorage is not a stolen account.
 */

import { Navigate, Outlet } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { ApiError, api, type Workspace } from '@/lib/api';

export function RequireSession() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api<Workspace>('/workspace'),
    retry: false,
  });

  if (isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }

  // 401 means sign in. Anything else is a real fault and should say so rather
  // than bouncing someone to a login form that will not help them.
  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/login" replace />;
  }
  if (error) {
    return (
      <p className="p-8 text-sm">
        {error instanceof Error ? error.message : 'Could not reach the workspace.'}
      </p>
    );
  }

  return data ? <Outlet /> : <Navigate to="/login" replace />;
}

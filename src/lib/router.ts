'use client';

/**
 * Simple client-side router using window.history + hash.
 * Since the preview only exposes the `/` route, we manage navigation client-side.
 */

import { useCallback, useEffect, useState } from 'react';

export type Route =
  | { name: 'chat'; conversationId?: string }
  | { name: 'auth'; mode: 'login' | 'register' }
  | { name: 'admin'; tab?: 'dashboard' | 'users' | 'conversations' | 'audit' | 'settings'; conversationId?: string }
  | { name: 'profile' };

function parseHash(): Route {
  if (typeof window === 'undefined') return { name: 'auth', mode: 'login' };
  const hash = window.location.hash.replace(/^#/, '') || '/';
  // Examples:
  //   #/chat
  //   #/chat/c123
  //   #/auth/login
  //   #/admin/users
  //   #/admin/conversations/c123
  if (hash.startsWith('/chat/')) {
    return { name: 'chat', conversationId: hash.slice(6) };
  }
  if (hash === '/chat') return { name: 'chat' };
  if (hash.startsWith('/auth/register')) return { name: 'auth', mode: 'register' };
  if (hash.startsWith('/auth/login')) return { name: 'auth', mode: 'login' };
  if (hash.startsWith('/admin/users')) return { name: 'admin', tab: 'users' };
  if (hash.startsWith('/admin/conversations/')) {
    return { name: 'admin', tab: 'conversations', conversationId: hash.slice('/admin/conversations/'.length) };
  }
  if (hash.startsWith('/admin/conversations')) return { name: 'admin', tab: 'conversations' };
  if (hash.startsWith('/admin/audit')) return { name: 'admin', tab: 'audit' };
  if (hash.startsWith('/admin/settings')) return { name: 'admin', tab: 'settings' };
  if (hash.startsWith('/admin')) return { name: 'admin', tab: 'dashboard' };
  if (hash.startsWith('/profile')) return { name: 'profile' };
  return { name: 'chat' };
}

function routeToHash(route: Route): string {
  switch (route.name) {
    case 'chat':
      return route.conversationId ? `/chat/${route.conversationId}` : '/chat';
    case 'auth':
      return `/auth/${route.mode}`;
    case 'admin':
      switch (route.tab) {
        case 'users': return '/admin/users';
        case 'conversations':
          return route.conversationId ? `/admin/conversations/${route.conversationId}` : '/admin/conversations';
        case 'audit': return '/admin/audit';
        case 'settings': return '/admin/settings';
        default: return '/admin';
      }
    case 'profile': return '/profile';
  }
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) {
      window.location.hash = '/chat';
    }
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const push = useCallback((r: Route) => {
    window.location.hash = routeToHash(r);
  }, []);

  const replace = useCallback((r: Route) => {
    window.location.replace(`#${routeToHash(r)}`);
  }, []);

  return { route, push, replace };
}

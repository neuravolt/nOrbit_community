'use client';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

export function DynamicFavicon() {
  // Runs on every page, including sign-in, client and student pages, so it reads the public
  // profile with a plain fetch: the staff-only endpoint 401s there and set off token refreshes.
  const { data: profile } = useQuery({
    queryKey: ['company-profile-public'],
    queryFn: async () => {
      const r = await fetch('/api/company-profile/public');
      return r.ok ? ((await r.json()) as { faviconUrl?: string | null }) : null;
    },
    staleTime: 10 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (profile?.faviconUrl) {
      const getFullUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        const base = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || '/api');
        return `${base}${url}`;
      };

      const faviconUrl = getFullUrl(profile.faviconUrl);

      // Find or create shortcut icon link
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = faviconUrl;
      link.type = 'image/x-icon';
    }
  }, [profile?.faviconUrl]);

  return null;
}

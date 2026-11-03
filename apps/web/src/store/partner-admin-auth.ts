import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PartnerAdmin {
  id: string;
  email: string;
  fullName: string;
  role: string;
  partnerId: string;
  partnerName: string;
  mustChangePassword?: boolean;
}

interface PartnerAdminAuthState {
  partnerAdmin: PartnerAdmin | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setPartnerAdmin: (partnerAdmin: PartnerAdmin) => void;
  logout: () => void;
}

export const usePartnerAdminAuthStore = create<PartnerAdminAuthState>()(
  persist(
    (set) => ({
      partnerAdmin: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setTokens: (accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          document.cookie = `partner_admin_token=${accessToken}; path=/; max-age=604800; SameSite=Lax; Secure`;
        }
        set({ accessToken, refreshToken, isAuthenticated: true });
      },
      setPartnerAdmin: (partnerAdmin) => set({ partnerAdmin }),
      logout: () => {
        if (typeof window !== 'undefined') {
          document.cookie = "partner_admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
        set({ partnerAdmin: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'partner-admin-auth-storage',
    }
  )
);

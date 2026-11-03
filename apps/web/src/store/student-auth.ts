import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Student {
  id: string;
  email: string;
  fullName: string;
  level: number;
  status: string;
  mustChangePassword?: boolean;
}

interface StudentAuthState {
  student: Student | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setStudent: (student: Student) => void;
  logout: () => void;
}

export const useStudentAuthStore = create<StudentAuthState>()(
  persist(
    (set) => ({
      student: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setTokens: (accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          document.cookie = `student_token=${accessToken}; path=/; max-age=604800; SameSite=Lax; Secure`;
        }
        set({ accessToken, refreshToken, isAuthenticated: true });
      },
      setStudent: (student) => set({ student }),
      logout: () => {
        if (typeof window !== 'undefined') {
          document.cookie = "student_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
        set({ student: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'student-auth-storage',
    }
  )
);

import axios from 'axios';
import { useAuthStore } from '../store/auth';
import { useStudentAuthStore } from '../store/student-auth';
import { usePartnerAdminAuthStore } from '../store/partner-admin-auth';

export const api = axios.create({
  baseURL: typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || '/api'),
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token and enforce browser baseURL
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      if (!config.baseURL || config.baseURL.includes('localhost:3001')) {
        config.baseURL = '/api';
      }
    }

    const isPartnerAdminPortal = typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/launchpad-partner');

    const isStudentPortal = typeof window !== 'undefined' &&
      (window.location.pathname.startsWith('/launchpad') || window.location.pathname.startsWith('/student')) &&
      !window.location.pathname.startsWith('/launchpad-admin') &&
      !isPartnerAdminPortal;

    if (isPartnerAdminPortal) {
      const { accessToken } = usePartnerAdminAuthStore.getState();
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    } else if (isStudentPortal) {
      const { accessToken } = useStudentAuthStore.getState();
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    } else {
      const { accessToken } = useAuthStore.getState();
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Handle 401s and Refresh Tokens
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and it's not a retry already
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const isPartnerAdminPortal = typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/launchpad-partner');

      const isStudentPortal = typeof window !== 'undefined' &&
        (window.location.pathname.startsWith('/launchpad') || window.location.pathname.startsWith('/student')) &&
        !window.location.pathname.startsWith('/launchpad-admin') &&
        !isPartnerAdminPortal;

      if (isPartnerAdminPortal) {
        const { refreshToken, setTokens, logout } = usePartnerAdminAuthStore.getState();

        if (!refreshToken) {
          logout();
          isRefreshing = false;
          return Promise.reject(error);
        }

        try {
          const refreshUrl = typeof window !== 'undefined' ? '/api/launchpad/partner-portal/auth/refresh' : `${api.defaults.baseURL}/launchpad/partner-portal/auth/refresh`;
          const { data } = await axios.post(refreshUrl, {
            refreshToken,
          });

          setTokens(data.accessToken, data.refreshToken);
          processQueue(null, data.accessToken);
          isRefreshing = false;

          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          isRefreshing = false;
          logout();
          if (typeof window !== 'undefined') {
            window.location.href = '/launchpad-partner/login';
          }
          return Promise.reject(refreshError);
        }
      } else if (isStudentPortal) {
        const { refreshToken, setTokens, logout } = useStudentAuthStore.getState();

        if (!refreshToken) {
          logout();
          isRefreshing = false;
          return Promise.reject(error);
        }

        try {
          const refreshUrl = typeof window !== 'undefined' ? '/api/launchpad/auth/refresh' : `${api.defaults.baseURL}/launchpad/auth/refresh`;
          const { data } = await axios.post(refreshUrl, {
            refreshToken,
          });

          setTokens(data.accessToken, data.refreshToken);
          processQueue(null, data.accessToken);
          isRefreshing = false;

          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          isRefreshing = false;
          logout();
          if (typeof window !== 'undefined') {
            window.location.href = '/launchpad/login';
          }
          return Promise.reject(refreshError);
        }
      } else {
        const { refreshToken, setTokens, logout } = useAuthStore.getState();

        if (!refreshToken) {
          logout();
          isRefreshing = false;
          return Promise.reject(error);
        }

        try {
          const refreshUrl = typeof window !== 'undefined' ? '/api/auth/refresh' : `${api.defaults.baseURL}/auth/refresh`;
          const { data } = await axios.post(refreshUrl, {
            refreshToken,
          });

          setTokens(data.accessToken, data.refreshToken);
          processQueue(null, data.accessToken);
          isRefreshing = false;

          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          isRefreshing = false;
          logout();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

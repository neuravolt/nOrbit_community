import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// ─── Mutation helper ──────────────────────────────────────────────────────────
export const useCreate = (resource: string, queryKey: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => api.post(`/${resource}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });
};

export const useUpdate = (resource: string, queryKey: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; [key: string]: any }) => api.patch(`/${resource}/${id}`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: [resource] });
    },
  });
};

export const useDelete = (resource: string, queryKey: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/${resource}/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: [resource] });
    },
  });
};

// ─── Clients ──────────────────────────────────────────────────────────────────
export const useClients = (params?: any) => {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: async () => {
      const { data } = await api.get('/clients', { params });
      return data as { clients: any[]; total: number; page: number; totalPages: number };
    },
  });
};

// All clients for select dropdowns (no pagination)
export const useAllClients = () => {
  return useQuery({
    queryKey: ['clients-all'],
    queryFn: async () => {
      const { data } = await api.get('/clients', { params: { limit: 200 } });
      return (data?.clients || []) as any[];
    },
    staleTime: 30_000,
  });
};

// ─── Leads ────────────────────────────────────────────────────────────────────
export const useLeads = (params?: any) => {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: async () => {
      const { data } = await api.get('/leads', { params });
      return data as { leads: any[]; total: number; page: number; totalPages: number };
    },
  });
};

export const useLeadMetrics = () => {
  return useQuery({
    queryKey: ['leads-metrics'],
    queryFn: async () => {
      const { data } = await api.get('/leads/metrics/conversion');
      return data;
    },
  });
};

export const useLeadApiKey = () => {
  return useQuery({
    queryKey: ['leads-api-key'],
    queryFn: async () => {
      const { data } = await api.get('/leads/api-key');
      return data as { apiKey: string; endpoint: string; hint: string };
    },
  });
};

export const useRegenerateLeadApiKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/leads/api-key/regenerate');
      return data as { apiKey: string; message: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads-api-key'] });
    },
  });
};

export const useConvertLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data?: Record<string, any> }) => {
      const response = await api.patch(`/leads/${id}/convert`, data || {});
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leads-metrics'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['clients-all'] });
    },
  });
};

// ─── Projects ─────────────────────────────────────────────────────────────────
export const useProjects = (params?: any) => {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: async () => {
      const { data } = await api.get('/projects', { params });
      return data as { projects: any[]; total: number; page: number; totalPages: number };
    },
  });
};

export const useProject = (id: string) => {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

// ─── Tickets ──────────────────────────────────────────────────────────────────
export const useTickets = (params?: any) => {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: async () => {
      const { data } = await api.get('/tickets', { params });
      return data as { tickets: any[]; total: number; page: number; totalPages: number };
    },
  });
};

// ─── Assets ───────────────────────────────────────────────────────────────────
export const useAssets = (params?: any) => {
  return useQuery({
    queryKey: ['assets', params],
    queryFn: async () => {
      const { data } = await api.get('/assets', { params });
      return data as { assets: any[]; total: number; page: number; totalPages: number };
    },
  });
};

/** One asset by id (pages about a single site/server must not search a paginated list). */
export const useAsset = (id?: string) => {
  return useQuery({
    queryKey: ['asset', id],
    queryFn: async () => (await api.get(`/assets/${id}`)).data as any,
    enabled: !!id,
  });
};

export const useUpcomingRenewals = () => {
  return useQuery({
    queryKey: ['assets-renewals-upcoming'],
    queryFn: async () => {
      const { data } = await api.get('/assets/renewals/upcoming');
      return data;
    },
  });
};

// ─── AMC Contracts ────────────────────────────────────────────────────────────
export const useAmcContracts = (params?: any) => {
  return useQuery({
    queryKey: ['amc-contracts', params],
    queryFn: async () => {
      const { data } = await api.get('/amc-contracts', { params });
      return data as { contracts: any[]; total: number; page: number; totalPages: number };
    },
  });
};

export const useAmcRenewalsDue = () => {
  return useQuery({
    queryKey: ['amc-renewals-due'],
    queryFn: async () => {
      const { data } = await api.get('/amc-contracts/renewals/due');
      return data;
    },
  });
};

// NOTE: useQuotes and useInvoices are defined below in the PSA section (scroll down)
// These aliases are kept for backwards compatibility with existing pages
// ─── Sales (Quotes — old compat alias removed, see PSA section) ───────────────

// ─── Billing (Invoices — old compat alias removed, see PSA section) ──────────


// ─── Users ────────────────────────────────────────────────────────────────────
export const useUsers = (params?: any) => {
  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const { data } = await api.get('/users', { params });
      return {
        users: data.data || [],
        total: data.meta?.total || 0,
        page: data.meta?.page || 1,
        totalPages: Math.ceil((data.meta?.total || 0) / (data.meta?.limit || 20)),
      };
    },
  });
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const useWeeklyReport = () => {
  return useQuery({
    queryKey: ['reports-weekly'],
    queryFn: async () => {
      const { data } = await api.get('/reports/weekly');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useTeamProductivity = () => {
  return useQuery({
    queryKey: ['reports-team-productivity'],
    queryFn: async () => {
      const { data } = await api.get('/reports/team-productivity');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useAmcHealthReport = () => {
  return useQuery({
    queryKey: ['reports-amc-health'],
    queryFn: async () => {
      const { data } = await api.get('/reports/amc-health');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// ─── Company Profile ──────────────────────────────────────────────────────────
export const useCompanyProfile = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['company-profile'],
    queryFn: async () => {
      const { data } = await api.get('/company-profile');
      return data;
    },
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
};

export const useUpsertCompanyProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => api.put('/company-profile', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-profile'] }),
  });
};

// ─── Service Catalog ─────────────────────────────────────────────────────────
export const useServiceCatalog = (params?: any) => {
  return useQuery({
    queryKey: ['service-catalog', params],
    queryFn: async () => {
      const { data } = await api.get('/service-catalog', { params });
      return data as { services: any[]; grouped: Record<string, Record<string, any[]>> };
    },
    staleTime: 60_000,
  });
};

export const useServiceCategories = () => {
  return useQuery({
    queryKey: ['service-catalog-categories'],
    queryFn: async () => {
      const { data } = await api.get('/service-catalog/categories');
      return data as Record<string, string[]>;
    },
    staleTime: 60_000,
  });
};

export const useCreateService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => api.post('/service-catalog', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-catalog'] }),
  });
};

export const useUpdateService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: any) => api.patch(`/service-catalog/${id}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-catalog'] }),
  });
};

export const useSeedServiceCatalog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/service-catalog/seed').then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-catalog'] }),
  });
};

export const useUpsertRateCard = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => api.post('/service-catalog/rate-cards', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-catalog'] }),
  });
};

// ─── Quotations ───────────────────────────────────────────────────────────────
export const useQuotes = (params?: any) => {
  return useQuery({
    queryKey: ['quotes', params],
    queryFn: async () => {
      const { data } = await api.get('/quotes', { params });
      return data as { quotes: any[]; total: number; page: number; totalPages: number };
    },
  });
};

export const useQuote = (id: string) => {
  return useQuery({
    queryKey: ['quote', id],
    queryFn: async () => {
      const { data } = await api.get(`/quotes/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => api.post('/quotes', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
};

export const useUpdateQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: any) => api.patch(`/quotes/${id}`, payload).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['quote', id] });
    },
  });
};

export const useSendQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/quotes/${id}/send`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
};

export const useAcceptQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/quotes/${id}/accept`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
};

export const useConvertQuoteToInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) => api.post(`/invoices/from-quote/${quoteId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
};

export const useCreateInvoiceFromAmc = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contractId: string) => api.post(`/invoices/from-amc/${contractId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['amc-contracts'] });
    },
  });
};

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => api.post('/invoices', payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
};

export const useSendOverdueReminders = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/invoices/send-overdue-reminders').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
};

export const useOverdueInvoices = () => {
  return useQuery({
    queryKey: ['invoices', 'overdue'],
    queryFn: async () => {
      const { data } = await api.get('/invoices/overdue');
      return data as any[];
    },
  });
};


export const useDeleteQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/quotes/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
};

export const useRejectQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/quotes/${id}/reject`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
};

export const useDeleteInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
};


// ─── Invoices ─────────────────────────────────────────────────────────────────
export const useInvoices = (params?: any) => {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: async () => {
      const { data } = await api.get('/invoices', { params });
      return data as { invoices: any[]; total: number; page: number; totalPages: number };
    },
  });
};

export const useInvoice = (id: string) => {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data } = await api.get(`/invoices/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useRecordPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: any) => api.patch(`/invoices/${id}/record-payment`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
};

// ─── Manual Payment Submissions ───────────────────────────────────────────────
export const useManualPayments = (params?: any) => {
  return useQuery({
    queryKey: ['manual-payments', params],
    queryFn: async () => {
      const { data } = await api.get('/billing/manual-payments', { params });
      return data as { data: any[]; meta: { total: number; page: number; limit: number; totalPages: number } };
    },
  });
};

export const useApproveManualPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/billing/manual-payments/${id}/approve`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manual-payments'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
};

export const useRejectManualPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      api.post(`/billing/manual-payments/${id}/reject`, { rejectionReason }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manual-payments'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
};

// ─── AMC Weekly Reports ───────────────────────────────────────────────────────
export const useAmcWeeklyReports = (contractId: string) => {
  return useQuery({
    queryKey: ['amc-weekly-reports', contractId],
    queryFn: async () => {
      const { data } = await api.get(`/amc-contracts/${contractId}/weekly-reports`);
      return data as any[];
    },
    enabled: !!contractId,
  });
};

export const useGenerateAmcWeeklyReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, ...payload }: any) =>
      api.post(`/amc-contracts/${contractId}/weekly-reports/generate`, payload).then(r => r.data),
    onSuccess: (_, { contractId }) => qc.invalidateQueries({ queryKey: ['amc-weekly-reports', contractId] }),
  });
};

export const useUpdateAmcReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, ...payload }: any) =>
      api.patch(`/amc-contracts/weekly-reports/${reportId}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amc-weekly-reports'] }),
  });
};

export const useUploadCompanyLogo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/company-profile/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-profile'] }),
  });
};

export const useUploadCompanySignature = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/company-profile/signature', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-profile'] }),
  });
};

export const useUploadCompanyStamp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/company-profile/stamp', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-profile'] }),
  });
};

export const useUploadCompanyFavicon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/company-profile/favicon', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-profile'] }),
  });
};

export const useUploadAttachment = () => {
  return useMutation({
    mutationFn: ({
      file,
      taskId,
      ticketId,
      projectId,
      isInternal,
      customName,
      category,
    }: {
      file: File;
      taskId?: string;
      ticketId?: string;
      projectId?: string;
      isInternal?: boolean;
      customName?: string;
      category?: string;
    }) => {
      const fd = new FormData();
      fd.append('file', file);
      if (taskId) fd.append('taskId', taskId);
      if (ticketId) fd.append('ticketId', ticketId);
      if (projectId) fd.append('projectId', projectId);
      if (isInternal !== undefined) fd.append('isInternal', String(isInternal));
      if (customName) fd.append('customName', customName);
      if (category) fd.append('category', category);
      return api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
  });
};

export const useCreateLinkAttachment = () => {
  return useMutation({
    mutationFn: ({
      url,
      title,
      taskId,
      ticketId,
      projectId,
      isInternal,
      category,
    }: {
      url: string;
      title: string;
      taskId?: string;
      ticketId?: string;
      projectId?: string;
      isInternal?: boolean;
      category?: string;
    }) => {
      return api.post('/upload/link', {
        url,
        title,
        taskId,
        ticketId,
        projectId,
        isInternal,
        category,
      }).then(r => r.data);
    },
  });
};

export const useDeleteAttachment = () => {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/upload/${id}`).then(r => r.data),
  });
};

export const useGlobalResources = () => {
  return useQuery({
    queryKey: ['global-resources'],
    queryFn: async () => {
      const { data } = await api.get('/upload/resources');
      return data as any[];
    },
  });
};

export const useBundles = () => {
  return useQuery({
    queryKey: ['service-bundles'],
    queryFn: async () => {
      const { data } = await api.get('/service-catalog/bundles');
      return data as any[];
    },
  });
};

export const useCreateBundle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => api.post('/service-catalog/bundles', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-bundles'] }),
  });
};

export const useTasks = () => {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data } = await api.get('/tasks');
      return data as any[];
    },
  });
};

export const useRoles = () => {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get('/roles');
      return data as any[];
    },
  });
};

export const useRole = (id: string) => {
  return useQuery({
    queryKey: ['role', id],
    queryFn: async () => {
      const { data } = await api.get(`/roles/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const usePermissions = () => {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data } = await api.get('/permissions');
      return data as any[];
    },
  });
};

export const useCreateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => api.post('/roles', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
};

export const useUpdateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: any) => api.patch(`/roles/${id}`, payload).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      qc.invalidateQueries({ queryKey: ['role', id] });
    },
  });
};

export const useDeleteRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
};

export const useAmcContract = (id: string) => {
  return useQuery({
    queryKey: ['amc-contract', id],
    queryFn: async () => {
      const { data } = await api.get(`/amc-contracts/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useAmcWeeklyReport = (reportId: string) => {
  return useQuery({
    queryKey: ['amc-weekly-report', reportId],
    queryFn: async () => {
      const { data } = await api.get(`/amc-contracts/weekly-reports/${reportId}`);
      return data;
    },
    enabled: !!reportId,
  });
};

export const useAuditLogs = (params?: any) => {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => {
      const { data } = await api.get('/audit-logs', { params });
      return data;
    },
  });
};

// ─── Guardian Agent ───────────────────────────────────────────────────────────
export const useGuardianAgents = () => {
  return useQuery({
    queryKey: ['guardian-agents'],
    queryFn: async () => {
      const { data } = await api.get('/guardian/agents');
      return data;
    },
  });
};

export const useGuardianAgentStatus = (agentId: string) => {
  return useQuery({
    queryKey: ['guardian-agent-status', agentId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/agents/${agentId}/status`);
      return data;
    },
    enabled: !!agentId,
    refetchInterval: 30000, // refresh status every 30 seconds
  });
};

// Guardian WordPress-security plan §3/§4: the single aggregate "protected / issue found" status
// per Asset — the dashboard badge's only data source, so it never reconciles malware/security/
// wordpress scan shapes itself. 60s poll: this reflects a nightly-cron result, not something that
// needs the 15-30s cadence other live-metric hooks use.
export const useGuardianAssetProtectionStatus = (assetId?: string) => {
  return useQuery({
    queryKey: ['guardian-asset-protection-status', assetId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/assets/${assetId}/protection-status`);
      return data as { status: 'protected' | 'issues_found' | 'never_scanned' | 'stale'; lastCheckedAt: string | null; findings: Array<{ category: string; summary: string; severity: string }> };
    },
    enabled: !!assetId,
    refetchInterval: 60000,
  });
};

// First UI exposure for these three trigger endpoints — confirmed this session that the backend
// scan capabilities (malware/security/wordpress) existed with no "Run scan now" button anywhere.
export const useTriggerGuardianMalwareScan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => api.post(`/guardian/agents/${agentId}/malware-scan`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guardian-asset-protection-status'] }),
  });
};

export const useTriggerGuardianSecurityScan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => api.post(`/guardian/agents/${agentId}/security-scan`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guardian-asset-protection-status'] }),
  });
};

export const useTriggerGuardianWordPressScan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => api.post(`/guardian/agents/${agentId}/wordpress-scan`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guardian-asset-protection-status'] }),
  });
};

// Real Fail2ban/rkhunter/chkrootkit/lynis/firewall/port data for the Fleet Security tab (Managed
// VPS only — BYOVPS has no equivalent command type yet, see that tab's own honest empty state).
export const useGuardianSecurityStatus = (agentId?: string) => {
  return useQuery({
    queryKey: ['guardian-security-status', agentId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/agents/${agentId}/security-status`);
      return data;
    },
    enabled: !!agentId,
    refetchInterval: 60000,
  });
};

// Security tab of a Fleet server (BYOVPS too): attack-surface audit + host snapshot + open findings.
export const useGuardianHostSecurity = (serverId?: string) => {
  return useQuery({
    queryKey: ['guardian-host-security', serverId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/agents/${serverId}/host-security`);
      return data;
    },
    enabled: !!serverId,
    // Poll quickly while a run is in progress (it runs in the background on the API).
    refetchInterval: (query: any) => (query.state.data?.running ? 5000 : 120000),
  });
};

export const useRunGuardianHostSecurity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (serverId: string) => {
      const { data } = await api.post(`/guardian/agents/${serverId}/host-security/run`, {}, { timeout: 30000 });
      return data;
    },
    onSuccess: (data, serverId) => queryClient.setQueryData(['guardian-host-security', serverId], data),
  });
};

export const useGuardianMalwareScans = (agentId?: string) => {
  return useQuery({
    queryKey: ['guardian-malware-scans', agentId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/agents/${agentId}/malware-scans`);
      return data;
    },
    enabled: !!agentId,
    refetchInterval: 30000,
  });
};

export const useGuardianInfectionAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ infectionId, action }: { infectionId: string; action: 'quarantine' | 'restore' | 'delete' }) =>
      api.post(`/guardian/infections/${infectionId}/${action}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guardian-malware-scans'] }),
  });
};

export const useGuardianDiscoveries = (agentId: string) => {
  return useQuery({
    queryKey: ['guardian-discoveries', agentId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/agents/${agentId}/discoveries`);
      return data;
    },
    enabled: !!agentId,
  });
};

// Fleet-wide discovery listing — powers the Fleet page's "Discovery Approval" tab.
// approveDiscovery() has existed on the backend since before this session but had no UI consumer.
export const useAllGuardianDiscoveries = () => {
  return useQuery({
    queryKey: ['guardian-discoveries-all'],
    queryFn: async () => {
      const { data } = await api.get('/guardian/discoveries');
      return data;
    },
    refetchInterval: 30000,
  });
};

export const useApproveGuardianDiscovery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ discoveryId, approvedDomains }: { discoveryId: string; approvedDomains: string[] }) =>
      api.post(`/guardian/discoveries/${discoveryId}/approve`, { approvedDomains }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guardian-discoveries-all'] });
      qc.invalidateQueries({ queryKey: ['guardian-fleet'] });
    },
  });
};

// Fleet Operations (bulk restart etc.) — replaces the old fake setTimeout-based bulk action.
export const useCreateFleetBulkAction = () => {
  return useMutation({
    mutationFn: (payload: { actionType: string; targetAgentIds: string[]; payload?: Record<string, unknown> }) =>
      api.post('/guardian/fleet/bulk-action', payload).then((r) => r.data),
  });
};

export const useFleetOperationStatus = (operationId: string | null, refetchInterval: number | false = 2000) => {
  return useQuery({
    queryKey: ['guardian-fleet-operation', operationId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/fleet/operations/${operationId}`);
      return data;
    },
    enabled: !!operationId,
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.status;
      return status === 'COMPLETED' || status === 'FAILED' ? false : refetchInterval;
    },
  });
};

export const useGuardianMonitors = (websiteId?: string) => {
  return useQuery({
    queryKey: ['guardian-monitors', websiteId],
    queryFn: async () => {
      const { data } = await api.get('/guardian/monitors', {
        params: { websiteId, limit: 100 },
      });
      return data;
    },
  });
};

export const useGuardianLatestServerMonitor = (agentId: string) => {
  return useQuery({
    queryKey: ['guardian-latest-server-monitor', agentId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/agents/${agentId}/latest-monitor`);
      return data;
    },
    enabled: !!agentId,
    refetchInterval: 30000,
  });
};

export const useGuardianAlerts = (params?: { severity?: string; isResolved?: boolean }) => {
  return useQuery({
    queryKey: ['guardian-alerts', params],
    queryFn: async () => {
      const { data } = await api.get('/guardian/alerts', { params });
      return data;
    },
  });
};

export const useRegisterGuardianAgent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/guardian/agents', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guardian-agents'] });
    },
  });
};

export const useTriggerGuardianDiscovery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agentId: string) => {
      const { data } = await api.post(`/guardian/agents/${agentId}/discover`, {}, { timeout: 150000 });
      return data;
    },
    onSuccess: (_, agentId) => {
      qc.invalidateQueries({ queryKey: ['guardian-discoveries', agentId] });
      qc.invalidateQueries({ queryKey: ['guardian-agent-status', agentId] });
    },
  });
};

export const useResolveGuardianAlert = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data } = await api.patch(`/guardian/alerts/${alertId}/resolve`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guardian-alerts'] });
    },
  });
};

/**
 * One-Click Fix: quarantines suspicious WP files tied to an alert and then
 * resolves the alert. Takes the agentId (from the alert's agent relationship)
 * plus the list of suspicious file paths stored in alert.details.suspiciousFiles.
 */
export const useWpOneClickFix = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agentId,
      alertId,
      filePaths,
    }: {
      agentId: string;
      alertId: string;
      filePaths: string[];
    }) => {
      // Quarantine each suspicious file sequentially (fail-fast on first error)
      const results: any[] = [];
      for (const filePath of filePaths) {
        const { data } = await api.post(
          `/guardian/agents/${agentId}/wordpress/quarantine-file`,
          { filePath, purge: false },
        );
        results.push(data);
      }
      // Mark the originating alert as resolved
      await api.patch(`/guardian/alerts/${alertId}/resolve`);
      return results;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guardian-alerts'] });
      qc.invalidateQueries({ queryKey: ['guardian-website-alerts'] });
      qc.invalidateQueries({ queryKey: ['guardian-quarantine-registry'] });
    },
  });
};

/**
 * Quarantine Registry: list of all quarantined files for an agent.
 * Supports filtering by status ('QUARANTINED' | 'RESTORED' | 'PURGED') and domain.
 */
export const useQuarantineRegistry = (
  agentId?: string,
  filters?: { status?: string; domain?: string },
) => {
  return useQuery({
    queryKey: ['guardian-quarantine-registry', agentId, filters],
    queryFn: async () => {
      if (!agentId) return [];
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.domain) params.set('domain', filters.domain);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const { data } = await api.get(
        `/guardian/agents/${agentId}/wordpress/quarantine-registry${queryStr}`,
      );
      return data;
    },
    enabled: !!agentId,
  });
};

/**
 * Single quarantine record forensic detail (including 4KB preview).
 */
export const useQuarantineRecord = (recordId?: string) => {
  return useQuery({
    queryKey: ['guardian-quarantine-record', recordId],
    queryFn: async () => {
      if (!recordId) return null;
      const { data } = await api.get(`/guardian/quarantine-records/${recordId}`);
      return data;
    },
    enabled: !!recordId,
  });
};

/**
 * Restore a quarantined file back to original WordPress path.
 */
export const useRestoreWordPressFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agentId,
      recordId,
      restoredBy,
    }: {
      agentId: string;
      recordId: string;
      restoredBy?: string;
    }) => {
      const { data } = await api.post(
        `/guardian/agents/${agentId}/wordpress/restore-file`,
        { recordId, restoredBy: restoredBy || 'DEVELOPER_MANUAL' },
      );
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['guardian-quarantine-registry', variables.agentId] });
      qc.invalidateQueries({ queryKey: ['guardian-quarantine-record', variables.recordId] });
      qc.invalidateQueries({ queryKey: ['guardian-alerts'] });
    },
  });
};

/**
 * Permanently purge a quarantined file from /var/quarantine.
 */
export const usePurgeWordPressQuarantine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agentId,
      filePath,
    }: {
      agentId: string;
      filePath: string;
    }) => {
      const { data } = await api.post(
        `/guardian/agents/${agentId}/wordpress/quarantine-file`,
        { filePath, purge: true },
      );
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['guardian-quarantine-registry', variables.agentId] });
    },
  });
};

export const useConfigureGuardianThresholds = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { serverId: string; [key: string]: any }) => {
      const { data } = await api.post('/guardian/alerts/configure', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guardian-agents'] });
    },
  });
};

export const useGuardianNginxConfig = (websiteId: string) => {
  return useQuery({
    queryKey: ['guardian-nginx-config', websiteId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/nginx/${websiteId}/config`);
      return data;
    },
    enabled: !!websiteId,
  });
};

export const useUpdateGuardianNginxConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ websiteId, payload }: { websiteId: string; payload: any }) => {
      const { data } = await api.put(`/guardian/nginx/${websiteId}/config`, payload);
      return data;
    },
    onSuccess: (_, { websiteId }) => {
      qc.invalidateQueries({ queryKey: ['guardian-nginx-config', websiteId] });
    },
  });
};

export const useApplyGuardianNginxConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (websiteId: string) => {
      const { data } = await api.post(`/guardian/nginx/${websiteId}/apply`);
      return data;
    },
    onSuccess: (_, websiteId) => {
      qc.invalidateQueries({ queryKey: ['guardian-nginx-config', websiteId] });
      qc.invalidateQueries({ queryKey: ['guardian-nginx-status', websiteId] });
    },
  });
};

export const useTestGuardianNginxConfig = () => {
  return useMutation({
    mutationFn: async (websiteId: string) => {
      const { data } = await api.post(`/guardian/nginx/${websiteId}/test`);
      return data;
    },
  });
};

export const useGetGuardianNginxStatus = (websiteId: string) => {
  return useQuery({
    queryKey: ['guardian-nginx-status', websiteId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/nginx/${websiteId}/status`);
      return data;
    },
    enabled: !!websiteId,
    refetchInterval: 30000,
  });
};

export const useGuardianDashboardWebsites = (refetchInterval: number | false = 10000) => {
  return useQuery({
    queryKey: ['guardian-dashboard-websites'],
    queryFn: async () => {
      const { data } = await api.get('/guardian/dashboard/websites');
      return data;
    },
    refetchInterval,
  });
};

export const useGuardianDashboardOverview = (refetchInterval: number | false = 10000) => {
  return useQuery({
    queryKey: ['guardian-dashboard-overview'],
    queryFn: async () => {
      const { data } = await api.get('/guardian/dashboard/overview');
      return data;
    },
    refetchInterval,
  });
};

export const useSuperAdminResources = (refetchInterval: number | false = 10000) => {
  return useQuery({
    queryKey: ['super-admin-resources'],
    queryFn: async () => {
      const { data } = await api.get('/guardian/super-admin/resources');
      return data;
    },
    refetchInterval,
  });
};

export const useGuardianFleet = (refetchInterval: number | false = 10000) => {
  return useQuery({
    queryKey: ['guardian-fleet'],
    queryFn: async () => {
      const { data } = await api.get('/guardian/fleet');
      return data;
    },
    refetchInterval,
    // Ride out an API restart (502/503/504) instead of showing an error on the first miss.
    retry: (count: number, err: any) => ![401, 403].includes(err?.response?.status) && count < 4,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
  });
};

export const useGuardianWebsiteMetrics = (websiteId: string, refetchInterval: number | false = 10000) => {
  return useQuery({
    queryKey: ['guardian-website-metrics', websiteId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/monitors/${websiteId}`);
      return data;
    },
    enabled: !!websiteId,
    refetchInterval,
  });
};

export const useGuardianWebsiteHistory = (websiteId: string, range: string = '24h') => {
  return useQuery({
    queryKey: ['guardian-website-history', websiteId, range],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/monitors/${websiteId}/history?range=${range}`);
      return data;
    },
    enabled: !!websiteId,
  });
};

export const useAcknowledgeGuardianAlert = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data } = await api.patch(`/guardian/alerts/${alertId}/acknowledge`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guardian-alerts'] });
      qc.invalidateQueries({ queryKey: ['guardian-website-alerts'] });
    },
  });
};

export const useEscalateGuardianAlert = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data } = await api.patch(`/guardian/alerts/${alertId}/escalate`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guardian-alerts'] });
      qc.invalidateQueries({ queryKey: ['guardian-website-alerts'] });
    },
  });
};

export const useGuardianWebsiteAlerts = (websiteId: string) => {
  return useQuery({
    queryKey: ['guardian-website-alerts', websiteId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/alerts/website/${websiteId}`);
      return data;
    },
    enabled: !!websiteId,
  });
};

export const useTestGuardianNotificationChannels = () => {
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/guardian/alerts/test-channels', payload);
      return data;
    },
  });
};

export const useGuardianAutonomousActions = (agentId: string, refetchInterval: number | false = 10000) => {
  return useQuery({
    queryKey: ['guardian-autonomous-actions', agentId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/agents/${agentId}/autonomous-actions`);
      return data as any[];
    },
    enabled: !!agentId,
    refetchInterval,
  });
};

export const useExecuteSreCommand = () => {
  return useMutation({
    mutationFn: async ({ agentId, command }: { agentId: string; command: string }) => {
      const { data } = await api.post(
        `/guardian/agents/${agentId}/execute-sre-command`,
        { command },
        { timeout: 120000 }
      );
      return data as { success: boolean; stdout: string; stderr: string; code: number };
    },
  });
};

export const useExecuteSreCleanup = () => {
  return useMutation({
    mutationFn: async (payload: {
      agentId: string;
      command: string;
      confirmText: string;
      password: string;
      targetPath?: string;
      sizeMB?: number;
      description?: string;
    }) => {
      const { agentId, ...body } = payload;
      const { data } = await api.post(
        `/guardian/agents/${agentId}/execute-sre-cleanup`,
        body,
        { timeout: 300000 }
      );
      return data as { success: boolean; stdout: string; stderr: string; code: number };
    },
  });
};

export const useGuardianStorageDrilldown = (agentId?: string) => {
  return useQuery({
    queryKey: ['guardian-storage-drilldown', agentId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/agents/${agentId}/storage-drilldown`);
      return (data?.categories || {}) as Record<
        string,
        Array<{
          label: string;
          path: string;
          sizeMB: number;
          description: string;
          cleanable: boolean;
          actionHint?: string;
          exists?: boolean;
          status?: 'active' | 'cleaned' | 'missing';
        }>
      >;
    },
    enabled: !!agentId,
    staleTime: 15000,
  });
};

export const useGetNginxLogs = () => {
  return useMutation({
    mutationFn: async ({ agentId, websiteName, logType }: { agentId: string; websiteName: string; logType: string }) => {
      const { data } = await api.get(`/guardian/agents/${agentId}/nginx-logs`, {
        params: { websiteName, logType }
      });
      return data as { success: boolean; logs: string };
    },
  });
};

export const useGuardianNotificationDeliveryLogs = (
  params?: { status?: string; type?: string; limit?: number },
  refetchInterval: number | false = 10000
) => {
  return useQuery({
    queryKey: ['guardian-notification-delivery-logs', params],
    queryFn: async () => {
      const { data } = await api.get('/guardian/notifications/delivery-logs', { params });
      return data as any[];
    },
    refetchInterval,
  });
};

/** ── BYOVPS Remote Operations (command-queue backed, no SSH) ── */

type GuardianCommandResult = {
  id: string;
  status: 'PENDING' | 'DELIVERED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  stdout?: string | null;
  stderr?: string | null;
  exitCode?: number | null;
};

export const useRestartService = () => {
  return useMutation({
    mutationFn: async ({ assetId, service }: { assetId: string; service: string }) => {
      const { data } = await api.post(`/guardian/assets/${assetId}/service/restart`, { service }, { timeout: 60000 });
      return data as GuardianCommandResult;
    },
  });
};

export const useStartService = () => {
  return useMutation({
    mutationFn: async ({ assetId, service }: { assetId: string; service: string }) => {
      const { data } = await api.post(`/guardian/assets/${assetId}/service/start`, { service }, { timeout: 60000 });
      return data as GuardianCommandResult;
    },
  });
};

export const useStopService = () => {
  return useMutation({
    mutationFn: async ({ assetId, service }: { assetId: string; service: string }) => {
      const { data } = await api.post(`/guardian/assets/${assetId}/service/stop`, { service }, { timeout: 60000 });
      return data as GuardianCommandResult;
    },
  });
};

export const useDiagnosticsBundle = () => {
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { data } = await api.get(`/guardian/assets/${assetId}/diagnostics`, { timeout: 60000 });
      return data as GuardianCommandResult;
    },
  });
};

export const useProcessList = () => {
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { data } = await api.get(`/guardian/assets/${assetId}/processes`, { timeout: 60000 });
      return data as GuardianCommandResult;
    },
  });
};

export const useRunRemediation = () => {
  return useMutation({
    mutationFn: async ({ assetId, actionId }: { assetId: string; actionId: string }) => {
      const { data } = await api.post(`/guardian/assets/${assetId}/remediation`, { actionId }, { timeout: 60000 });
      return data as GuardianCommandResult;
    },
  });
};

export const useByovpsLogs = () => {
  return useMutation({
    mutationFn: async ({ assetId, source, target, logType, lines }: { assetId: string; source: string; target?: string; logType?: string; lines?: number }) => {
      const { data } = await api.get(`/guardian/assets/${assetId}/logs`, { params: { source, target, logType, lines }, timeout: 60000 });
      return data as GuardianCommandResult;
    },
  });
};

/** Fetch all alerts for a specific Guardian agent (per-node) */
/** Attack and access activity per hour for the last 24 hours (failed SSH, web logins, probes, 404s, blocked). */
export type ServiceUsageSample = { t: number; u: Record<string, [number, number]>; p: Record<string, [number, number]> };
export const useGuardianServiceUsage = (agentId: string | undefined, refetchInterval: number | false = 15000) => {
  return useQuery({
    queryKey: ['guardian-service-usage', agentId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/agents/${agentId}/service-usage`);
      return data as { samples: ServiceUsageSample[] };
    },
    enabled: !!agentId,
    refetchInterval,
  });
};

export const useGuardianAttackActivity = (agentId: string | undefined, refetchInterval: number | false = 60000) => {
  return useQuery({
    queryKey: ['guardian-attack-activity', agentId],
    queryFn: async () => {
      const { data } = await api.get(`/guardian/agents/${agentId}/attack-activity`);
      return data as { hours: { start: string; sshFailures: number; loginAttempts: number; probes: number; notFound: number; blocked: number }[]; totals: Record<string, number> };
    },
    enabled: !!agentId,
    refetchInterval,
  });
};

export const useGuardianAgentAlerts = (agentId: string, refetchInterval: number | false = 15000) => {
  return useQuery({
    queryKey: ['guardian-agent-alerts', agentId],
    queryFn: async () => {
      const { data } = await api.get('/guardian/alerts', { params: { agentId } });
      return data as any[];
    },
    enabled: !!agentId,
    refetchInterval,
  });
};

// ─── Meetings Module Hooks ──────────────────────────────────────────────────
export const useMeetings = (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['meetings', params],
    queryFn: async () => {
      const { data } = await api.get('/meetings', { params });
      return data;
    },
  });
};

export const useMeetingDetails = (id: string) => {
  return useQuery({
    queryKey: ['meetings', id],
    queryFn: async () => {
      const { data } = await api.get(`/meetings/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCancelMeeting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/meetings/${id}/cancel`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
};


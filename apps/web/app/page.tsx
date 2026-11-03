'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '../src/store/auth';
import {
  useProjects, useTickets, useAmcRenewalsDue, useInvoices, useClients,
  useLeads, useQuotes, useAmcContracts, useTasks
} from '../src/hooks/queries';
import { useQuery } from '@tanstack/react-query';
import { api } from '../src/lib/api';

import {
  Briefcase, AlertTriangle, DollarSign, Users, TrendingUp, Building2,
  CheckCircle2, Clock, FolderOpen, FolderKanban, FileText, Receipt, Layers, BarChart3,
  ArrowRight, Activity, CheckSquare, TicketIcon, BookOpen,
  ChevronRight, Cpu, ShieldCheck, ExternalLink, Globe, Sparkles, Terminal, LogIn, UserPlus,
  X, Check, MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { OrgSwitcher } from './components/OrgSwitcher';
import { BarList, ChartCard, Donut, KpiCard, StackedBars } from '../src/components/ui/charts';
import { Badge, EmptyBlock, PageHeader, PageShell, TableCard, dayBuckets, statusTone, td, th } from '../src/components/ui/page';

const fmt = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';

// ─── Role-specific dashboard sub-components ──────────────────────────────────

function DevQADashboard({ user }: { user: any }) {
  const { data: myTasksData } = useQuery({
    queryKey: ['my-tasks', user?.id],
    queryFn: async () => {
      const { data } = await api.get(`/tasks?assigneeId=${user.id}&limit=50`);
      return data;
    },
    enabled: !!user?.id,
  });
  const { data: openTickets } = useTickets({ status: 'OPEN', limit: 5 });

  const myTasks = Array.isArray(myTasksData) ? myTasksData : myTasksData?.tasks || [];
  const todoTasks = myTasks.filter((t: any) => t.status === 'TODO' || t.status === 'todo');
  const inProgressTasks = myTasks.filter((t: any) => t.status === 'IN_PROGRESS' || t.status === 'in_progress');
  const reviewTasks = myTasks.filter((t: any) => t.status === 'REVIEW' || t.status === 'review');
  const doneTasks = myTasks.filter((t: any) => t.status === 'DONE' || t.status === 'done');

  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? 'Good morning' : greetHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{greeting}, {user?.firstName} 👋</h1>
          <p className="text-slate-500 text-sm mt-0.5">Here are your assignments for today</p>
        </div>

        {/* My Task Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'To Do', value: todoTasks.length, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
            { label: 'In Progress', value: inProgressTasks.length, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
            { label: 'In Review', value: reviewTasks.length, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
            { label: 'Done', value: doneTasks.length, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4`}>
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Employee Self-Service (ESS) Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
            <Briefcase size={16} className="text-indigo-600" /> Employee Self Service (HRMS)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/hr?tab=attendance" className="p-3 border border-slate-100 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all block text-center space-y-1">
              <Clock className="w-5 h-5 mx-auto text-blue-600" />
              <p className="text-xs font-bold text-slate-800">My Attendance</p>
              <p className="text-[10px] text-slate-400">Clock-in & logs</p>
            </Link>
            <Link href="/hr?tab=leaves" className="p-3 border border-slate-100 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all block text-center space-y-1">
              <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-600" />
              <p className="text-xs font-bold text-slate-800">Apply Leaves</p>
              <p className="text-[10px] text-slate-400">Balance & Requests</p>
            </Link>
            <Link href="/hr?tab=documents" className="p-3 border border-slate-100 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all block text-center space-y-1">
              <FileText className="w-5 h-5 mx-auto text-violet-600" />
              <p className="text-xs font-bold text-slate-800">Salary Slips</p>
              <p className="text-[10px] text-slate-400">Payslips & HR Docs</p>
            </Link>
            <Link href="/hr?tab=expenses" className="p-3 border border-slate-100 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all block text-center space-y-1">
              <Receipt className="w-5 h-5 mx-auto text-orange-600" />
              <p className="text-xs font-bold text-slate-800">Expense Claims</p>
              <p className="text-[10px] text-slate-400">Submit Reimbursements</p>
            </Link>
          </div>
        </div>

        {/* Kanban-style task list */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><CheckSquare size={18} className="text-blue-500" /> My Tasks</h2>
            <Link href="/tasks" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></Link>
          </div>
          <div className="divide-y divide-slate-50">
            {myTasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No tasks assigned yet</div>
            ) : myTasks.slice(0, 8).map((t: any) => {
              const statusColors: Record<string, string> = {
                TODO: 'bg-slate-100 text-slate-600', todo: 'bg-slate-100 text-slate-600',
                IN_PROGRESS: 'bg-blue-100 text-blue-700', in_progress: 'bg-blue-100 text-blue-700',
                REVIEW: 'bg-amber-100 text-amber-700', review: 'bg-amber-100 text-amber-700',
                DONE: 'bg-green-100 text-green-700', done: 'bg-green-100 text-green-700',
              };
              const priColors: Record<string, string> = {
                CRITICAL: 'bg-red-100 text-red-700',
                HIGH: 'bg-orange-100 text-orange-700',
                MEDIUM: 'bg-yellow-100 text-yellow-700',
                LOW: 'bg-slate-100 text-slate-600',
              };
              return (
                <Link key={t.id} href="/tasks" className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{t.title}</p>
                    <p className="text-xs text-slate-400">{t.project?.name || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.dueDate && <span className="text-xs text-slate-400">{fmtDate(t.dueDate)}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priColors[t.priority] || 'bg-slate-100 text-slate-600'}`}>{t.priority}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[t.status] || 'bg-slate-100 text-slate-600'}`}>{t.status?.replace('_', ' ')}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Open Tickets */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><TicketIcon size={18} className="text-violet-500" /> Open Tickets</h2>
            <Link href="/tickets" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></Link>
          </div>
          <div className="divide-y divide-slate-50">
            {(openTickets?.tickets || []).length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">No open tickets</div>
            ) : (openTickets?.tickets || []).map((t: any) => (
              <Link key={t.id} href={`/tickets/${t.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-900">{t.title}</p>
                  <p className="text-xs text-slate-400">{t.client?.name || '—'}</p>
                </div>
                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">{t.priority}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SupportDashboard({ user }: { user: any }) {
  const { data: openTickets } = useTickets({ status: 'OPEN', limit: 10 });
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? 'Good morning' : greetHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{greeting}, {user?.firstName} 👋</h1>
          <p className="text-slate-500 text-sm mt-0.5">Support queue for today</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500">Open Tickets</p>
            <p className="text-2xl font-bold text-violet-700 mt-1">{openTickets?.total ?? 0}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500">Awaiting Response</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">
              {(openTickets?.tickets || []).filter((t: any) => t.status === 'OPEN').length}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><TicketIcon size={18} className="text-violet-500" /> Open Tickets</h2>
            <Link href="/tickets" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></Link>
          </div>
          <div className="divide-y divide-slate-50">
            {(openTickets?.tickets || []).map((t: any) => (
              <Link key={t.id} href={`/tickets/${t.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-900">{t.title}</p>
                  <p className="text-xs text-slate-400">{t.client?.name || '—'}</p>
                </div>
                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">{t.priority}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountantDashboard({ user }: { user: any }) {
  const { data: invoicesData } = useInvoices({ limit: 50 });
  const { data: accountingSummary } = useQuery({
    queryKey: ['accounting-summary'],
    queryFn: async () => {
      const { data } = await api.get('/accounting/summary');
      return data;
    },
  });

  const invoices = invoicesData?.invoices || [];
  const totalRevenue = invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.grandTotal ?? 0), 0);
  const outstanding = invoices.filter((i: any) => ['sent', 'partial_paid'].includes(i.status)).reduce((s: number, i: any) => s + Number(i.balanceDue ?? 0), 0);
  const overdue = invoices.filter((i: any) => i.status === 'overdue').reduce((s: number, i: any) => s + Number(i.balanceDue ?? 0), 0);

  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? 'Good morning' : greetHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{greeting}, {user?.firstName} 👋</h1>
          <p className="text-slate-500 text-sm mt-0.5">Financial overview</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Revenue Collected', value: fmt(totalRevenue), color: 'text-green-700', bg: 'bg-green-50', href: '/billing' },
            { label: 'Outstanding', value: fmt(outstanding), color: 'text-blue-700', bg: 'bg-blue-50', href: '/billing' },
            { label: 'Overdue', value: fmt(overdue), color: 'text-red-700', bg: 'bg-red-50', href: '/billing' },
            { label: 'Bank Balance', value: fmt(accountingSummary?.bankBalance || 0), color: 'text-indigo-700', bg: 'bg-indigo-50', href: '/accounting' },
            { label: 'Expenses This Month', value: fmt(accountingSummary?.totalExpensesThisMonth || 0), color: 'text-orange-700', bg: 'bg-orange-50', href: '/accounting' },
            { label: 'Salaries This Month', value: fmt(accountingSummary?.totalSalaryThisMonth || 0), color: 'text-violet-700', bg: 'bg-violet-50', href: '/accounting' },
          ].map(s => (
            <Link key={s.label} href={s.href} className={`${s.bg} border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow`}>
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Purchase Register', icon: FileText, href: '/accounting?tab=purchases', cls: 'bg-indigo-600 hover:bg-indigo-700' },
            { label: 'Expense Register', icon: Receipt, href: '/accounting?tab=expenses', cls: 'bg-orange-600 hover:bg-orange-700' },
            { label: 'Bank Book', icon: BookOpen, href: '/accounting?tab=bank', cls: 'bg-blue-600 hover:bg-blue-700' },
            { label: 'Salary Register', icon: Users, href: '/accounting?tab=salaries', cls: 'bg-violet-600 hover:bg-violet-700' },
          ].map(action => (
            <Link key={action.label} href={action.href} className={`${action.cls} text-white rounded-xl p-4 flex items-center gap-3 transition-colors`}>
              <action.icon size={20} />
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── NORBIT Customer & Public SaaS Landing Page ──────────────────────────────

function NorbitEnterpriseLandingPage({
  user,
  isCustomer,
}: {
  user: any;
  isCustomer: boolean;
}) {
  const [activePreview, setActivePreview] = useState<'overview' | 'analytics'>('overview');

  const pillars = [
    {
      id: "guardian-sre",
      num: "01",
      category: "SRE & CYBER DEFENSE",
      title: "Guardian Autonomous SRE & Cyber Shield",
      valueProp: "Monitor infrastructure, throttle CPU spikes with cgroups, and auto-quarantine threats.",
      metricBadge: "2.8s Auto-Heal • Zero Midnight Crises",
      tagline: "Your 24/7 autonomous site reliability engineer that never sleeps.",
      icon: ShieldCheck,
      color: "from-blue-600 to-indigo-700",
      bgLight: "bg-blue-50/40 border-blue-200/80 hover:border-blue-400",
      accentText: "text-blue-600",
      badgeBg: "bg-blue-100/80 text-blue-800",
      features: [
        "Autonomous Threat Quarantine: 2s webshell isolation & IP auto-ban",
        "Linux cgroup Guard: Proactive CPU & memory throttling via systemd",
        "Mobile Voice Sirens: Spoken verbal audio alarms for P0 incidents",
        "Single-Command BYOVPS: Attach Hetzner, AWS, GCP, or bare-metal VPS",
      ],
      link: "https://norbit.neuravolt.in",
      linkText: "Explore Guardian Cloud →",
    },
    {
      id: "staging-devops",
      num: "02",
      category: "DEVOPS & DELIVERY",
      title: "DevOps Delivery & Scope Creep Protection",
      valueProp: "Manage Git task synchronization, SRE developer stopwatches, and client AMC retainer quotas.",
      metricBadge: "Zero Unbilled Hours • Real-Time Quotas",
      tagline: "Bridge the gap between engineering commits, client deliverables, and billable revenue.",
      icon: FolderKanban,
      color: "from-amber-500 to-orange-600",
      bgLight: "bg-amber-50/40 border-amber-200/80 hover:border-amber-400",
      accentText: "text-amber-600",
      badgeBg: "bg-amber-100/80 text-amber-800",
      features: [
        "GitHub PR Sync: Branches automatically update linked sprint task cards",
        "Live SRE Stopwatch: Real-time hours auto-deducted from AMC quotas",
        "Change Request Shield: Turn out-of-scope requests into billable quotes",
        "Unified Task Kanban: Sprint milestones & time logs without duplicate entry",
      ],
      link: isCustomer ? "/projects" : "/register",
      linkText: "Explore DevOps Delivery →",
    },
    {
      id: "neuracollect-ledger",
      num: "03",
      category: "FINANCE & PAYMENTS",
      title: "NeuraCollect & Operational Cash Flow Ledger",
      valueProp: "Connect dynamic UPI collections and gateway webhooks with automated cash flow and P&L registers.",
      metricBadge: "0% Platform Cuts • Live P&L",
      tagline: "Frictionless collections with automated cash flow reconciliation.",
      icon: Receipt,
      color: "from-cyan-600 to-blue-700",
      bgLight: "bg-cyan-50/40 border-cyan-200/80 hover:border-cyan-400",
      accentText: "text-cyan-700",
      badgeBg: "bg-cyan-100/80 text-cyan-800",
      features: [
        "Dynamic UPI QR Engine: Instant zero-fee dynamic QR on every invoice",
        "Multi-Gateway Webhook: Razorpay & Cashfree reconcile with HMAC-SHA256",
        "Operational Master Ledger: Syncs income, expenses, and payroll to live P&L",
        "Autonomous Chaser Cron: 9:00 AM WhatsApp & email chaser on Day 1, 3, 7",
      ],
      link: isCustomer ? "/billing" : "/register",
      linkText: "Explore Cash Flow Ledger →",
    },
    {
      id: "team-chat",
      num: "04",
      category: "TEAM & WORKSPACE COMMS",
      title: "In-House Team Chat, Mailbox & MeetPass",
      valueProp: "Unified native business email, real-time channel chat with Guardian DLP, and PIN-secured video calls.",
      metricBadge: "Zero Per-User Seat Taxes • Built-In DLP",
      tagline: "Real-time company communication without third-party surveillance.",
      icon: MessageSquare,
      color: "from-purple-600 to-violet-700",
      bgLight: "bg-purple-50/40 border-purple-200/80 hover:border-purple-400",
      accentText: "text-purple-600",
      badgeBg: "bg-purple-100/80 text-purple-800",
      features: [
        "In-House Native Mailbox: Send & receive business emails without Google",
        "Guardian DLP Redaction: Detects & redacts leaked AWS, SSH & Stripe secrets",
        "MeetPass Video Calls: PIN-secured client meeting rooms with zero Zoom links",
        "Contextual Task Conversion: Convert any chat or email to sprint tasks",
      ],
      link: isCustomer ? "/mailbox" : "/register",
      linkText: "Explore Workspace Comms →",
    },
    {
      id: "workforce-hrm",
      num: "05",
      category: "PEOPLE & IDENTITY",
      title: "Workforce HRM, Geofence & Dynamic RBAC",
      valueProp: "Manage employee lifecycle with GPS branch geofencing, biometric passkeys, and a 40+ permission RBAC matrix.",
      metricBadge: "DPDP-2023 Compliant • FIDO2 Passkeys",
      tagline: "Modern employee lifecycle with ironclad identity protection.",
      icon: Users,
      color: "from-emerald-600 to-teal-700",
      bgLight: "bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-400",
      accentText: "text-emerald-700",
      badgeBg: "bg-emerald-100/80 text-emerald-800",
      features: [
        "Branch GPS Geofencing: Strict GPS radius check for verified on-site check-in",
        "Biometric Passkeys: 128-d Euclidean face vector with liveness guard",
        "40+ Dynamic Roles Matrix: Granular permission controls across all resources",
        "Zero-Password Invites: Single-use cryptographic tokens for new hires",
      ],
      link: isCustomer ? "/hr" : "/register",
      linkText: "Explore Workforce HRM →",
    },
    {
      id: "client-portal",
      num: "06",
      category: "CLIENT EXPERIENCE",
      title: "Multi-Tenant White-Label Client Portal",
      valueProp: "Give clients one place to track work, approve quotes, submit tickets, and pay invoices with an internal security fence.",
      metricBadge: "100% Data Isolation • Transparent SLAs",
      tagline: "Give every client a branded self-service command center.",
      icon: Building2,
      color: "from-indigo-600 to-blue-700",
      bgLight: "bg-indigo-50/40 border-indigo-200/80 hover:border-indigo-400",
      accentText: "text-indigo-600",
      badgeBg: "bg-indigo-100/80 text-indigo-800",
      features: [
        "Attachment Boundary: Internal developer notes never leak to clients",
        "Live Deliverable Tracking: Inspect sprint milestones & digital sign-offs",
        "SLA Countdown Clocks: Transparent resolution countdowns & 1-click tickets",
        "Monday 9:00 AM Reports: Automated weekly executive summaries dispatched",
      ],
      link: isCustomer ? "/clients" : "/register",
      linkText: "Explore Client Portal →",
    },
  ];

  const oldWaySaaS = [
    { name: "Jira / Asana", cost: "$10 / user / mo", problem: "Complex licensing & bloated UI" },
    { name: "Salesforce / HubSpot", cost: "$25 / user / mo", problem: "Excessive pricing & fragmented leads" },
    { name: "Datadog / New Relic", cost: "$15 / server / mo", problem: "Exponential infra monitoring costs" },
    { name: "Slack / Teams", cost: "$8 / user / mo", problem: "Data scattered across external cloud" },
    { name: "Freshdesk / Zendesk", cost: "$15 / user / mo", problem: "Disconnected support ticket silos" },
    { name: "BambooHR / Keka", cost: "$10 / user / mo", problem: "Separate employee & payroll databases" },
    { name: "Stripe / Razorpay SDKs", cost: "2-3% + per txn", problem: "Multiple vendor contract lock-ins" },
  ];

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-neutral-900 selection:bg-blue-600 selection:text-white font-[Inter]">
      {/* ── Top Header Navigation ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-neutral-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <img
                src="/brand/norbit-logo.png"
                alt="nORBIT: One Platform. Your Entire Business."
                className="h-10 sm:h-12 w-auto object-contain select-none group-hover:opacity-90 transition"
              />
            </Link>
            <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-neutral-600">
              <a href="#pillars" className="hover:text-blue-600 transition">
                The 6 Pillars
              </a>
              <a href="#comparison" className="hover:text-blue-600 transition">
                Old Way vs nORBIT
              </a>
              <a href="#architecture" className="hover:text-blue-600 transition">
                Architecture
              </a>
              <a href="#pricing" className="hover:text-blue-600 transition">
                Plans &amp; Pricing
              </a>
              <Link href="/community" className="hover:text-blue-600 transition">
                Community Edition
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isCustomer ? (
              <div className="flex items-center gap-3">
                <OrgSwitcher />
                <Link
                  href="/projects"
                  className="text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-2.5 rounded-xl transition shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                >
                  <FolderKanban size={15} /> Workspace
                </Link>
              </div>
            ) : (
              <>
                <Link
                  href="/community"
                  className="hidden sm:inline-flex text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-3 py-2 transition"
                >
                  Self-Hosting
                </Link>
                <Link
                  href="/login"
                  className="text-xs sm:text-sm font-semibold text-neutral-700 hover:text-blue-600 px-3.5 py-2 transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 sm:px-5 py-2.5 rounded-xl transition shadow-md shadow-blue-500/25 flex items-center gap-1.5"
                >
                  Start Free Trial <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Customer Workspace Quick-Access Strip (If Logged In) ─────────── */}
      {isCustomer && (
        <section className="bg-gradient-to-r from-blue-50 via-indigo-50 to-white border-b border-blue-100 py-3.5 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {user?.firstName?.charAt(0) || "U"}
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-900">
                  Welcome back, {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-neutral-500">
                  Customer Workspace • Active Role:{" "}
                  <span className="font-semibold text-blue-700 uppercase">
                    {(user as any)?.role || "OWNER"}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs font-semibold text-neutral-700 hover:text-blue-600 hover:border-blue-300 transition shadow-2xs"
              >
                <FolderKanban size={13} className="text-blue-600" /> Projects
              </Link>
              <Link
                href="/tasks"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs font-semibold text-neutral-700 hover:text-emerald-600 hover:border-emerald-300 transition shadow-2xs"
              >
                <CheckSquare size={13} className="text-emerald-600" /> Tasks
              </Link>
              <Link
                href="/billing"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs font-semibold text-neutral-700 hover:text-amber-600 hover:border-amber-300 transition shadow-2xs"
              >
                <Receipt size={13} className="text-amber-600" /> Invoicing
              </Link>
              <Link
                href="/tickets"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs font-semibold text-neutral-700 hover:text-purple-600 hover:border-purple-300 transition shadow-2xs"
              >
                <TicketIcon size={13} className="text-purple-600" /> Tickets
              </Link>
              <Link
                href="/settings/billing"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
              >
                <Sparkles size={13} className="text-blue-600" /> Subscription &amp; Plans
              </Link>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-xs font-semibold text-white hover:bg-neutral-800 transition"
              >
                + New Org
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <section className="relative pt-16 sm:pt-24 pb-20 overflow-hidden">
        {/* Soft Radial Ambient Lighting */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08),transparent_70%)] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          {/* Official Badge matching neuravolt.in/norbit */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-neutral-200/90 shadow-xs mb-3">
            <span className="w-2 h-2 rounded-full bg-[#FF5A1F] animate-pulse" />
            <span className="text-[11px] sm:text-xs font-mono font-semibold tracking-wider text-neutral-700 uppercase">
              SOVEREIGN ALL-IN-ONE ENTERPRISE OPERATING SYSTEM
            </span>
          </div>

          {/* Central Logo Showcase */}
          <div className="flex justify-center mb-4">
            <img
              src="/brand/norbit-logo.png"
              alt="nORBIT: One Platform. Your Entire Business."
              className="h-14 sm:h-20 w-auto object-contain select-none drop-shadow-xs"
            />
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-[62px] font-extrabold text-neutral-900 tracking-tight leading-[1.12] font-[Space_Grotesk]">
            One Autonomous Operating System.
          </h1>

          <p className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
            From CRM &amp; Projects to Billing, SRE &amp; BioAuth.
          </p>

          <p className="text-base sm:text-lg text-neutral-600 max-w-3xl mx-auto leading-relaxed pt-2">
            Replace 8+ fragmented SaaS tools with one sovereign in-house stack: Guardian SRE,
            Staging DevOps, NeuraCollect UPI payments, team chat, Indian HRMS &amp; biometrics,
            and white-label client portals.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-6">
            {isCustomer ? (
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm transition shadow-lg shadow-blue-500/25"
              >
                Go to Workspace <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm transition shadow-lg shadow-blue-500/25"
                >
                  Start 14-Day Free Trial <ArrowRight size={16} />
                </Link>
                <a
                  href="#pillars"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-800 font-semibold text-sm transition shadow-2xs"
                >
                  Explore the 6 Pillars ↓
                </a>
                <Link
                  href="/community"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-sm transition shadow-md shadow-neutral-900/10"
                >
                  <Terminal size={15} className="text-blue-400" /> Self-Hosted Docker
                </Link>
              </>
            )}
          </div>

          {/* ── Dashboard Mockup Showcase (Interactive Tabs) ────────────────── */}
          <div className="pt-12 max-w-5xl mx-auto">
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-3 sm:p-4 shadow-2xl shadow-blue-900/10 relative">
              {/* Window Chrome Header */}
              <div className="flex items-center justify-between pb-3 px-2 border-b border-neutral-100 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                  <span className="text-xs font-mono text-neutral-400 ml-3 hidden sm:inline">
                    norbit.neuravolt.in — Unified Cockpit
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-lg text-xs font-semibold text-neutral-600">
                  <button
                    onClick={() => setActivePreview('overview')}
                    className={`px-3 py-1 rounded-md transition ${activePreview === 'overview' ? 'bg-white text-neutral-900 shadow-2xs' : 'hover:text-neutral-900'}`}
                  >
                    Enterprise Overview
                  </button>
                  <button
                    onClick={() => setActivePreview('analytics')}
                    className={`px-3 py-1 rounded-md transition ${activePreview === 'analytics' ? 'bg-white text-neutral-900 shadow-2xs' : 'hover:text-neutral-900'}`}
                  >
                    SRE &amp; Analytics
                  </button>
                </div>
              </div>

              {/* Main Image View */}
              <div className="relative rounded-xl overflow-hidden border border-neutral-100 bg-neutral-50 aspect-16/10">
                <img
                  src={activePreview === 'overview' ? "/brand/norbit-dashboard-preview.png" : "/brand/norbit-dashboard-preview-2.png"}
                  alt="nORBIT Enterprise Dashboard Preview"
                  className="w-full h-full object-cover object-top select-none transition-all duration-500"
                />

                {/* Floating Badges matching neuravolt.in */}
                <div className="absolute top-4 left-4 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-neutral-200/90 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span className="text-xs font-mono font-semibold text-neutral-800">
                    Sovereign Enterprise OS • 6 Pillars Active
                  </span>
                </div>

                <div className="absolute bottom-4 right-4 hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-neutral-200/90 shadow-md">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span className="text-xs font-semibold text-neutral-800">
                    100% Data Sovereignty • DPDP 2023 Compliant
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Grounded Key Metric Bar ───────────────────────────────────── */}
          <div className="pt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto text-left">
            <div className="p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-xs hover:border-blue-200 transition">
              <span className="text-3xl font-extrabold text-neutral-900 font-[Space_Grotesk]">₹0 Extra</span>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mt-1">SaaS Sprawl In-House</p>
              <p className="text-xs text-neutral-500 mt-0.5">Eliminate 8+ recurring foreign subscriptions.</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-xs hover:border-emerald-200 transition">
              <span className="text-3xl font-extrabold text-neutral-900 font-[Space_Grotesk]">100%</span>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mt-1">Data Sovereignty</p>
              <p className="text-xs text-neutral-500 mt-0.5">DPDP 2023 compliant data residency.</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-xs hover:border-purple-200 transition">
              <span className="text-3xl font-extrabold text-neutral-900 font-[Space_Grotesk]">Sub-2s</span>
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mt-1">Guardian Active Shield</p>
              <p className="text-xs text-neutral-500 mt-0.5">Continuous automated server auto-healing.</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-xs hover:border-indigo-200 transition">
              <span className="text-3xl font-extrabold text-neutral-900 font-[Space_Grotesk]">1 Platform</span>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mt-1">Unified Architecture</p>
              <p className="text-xs text-neutral-500 mt-0.5">Single sign-on, unified event mesh &amp; DB.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The 6 Sovereign Pillars Section ───────────────────────────────── */}
      <section id="pillars" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-neutral-200/80">
        <div className="text-center space-y-3 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <Sparkles size={13} /> The Core nORBIT Architecture
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight font-[Space_Grotesk]">
            The 6 Sovereign Pillars of nORBIT
          </h2>
          <p className="text-neutral-600 text-base sm:text-lg max-w-2xl mx-auto">
            Everything your business needs to build, bill, sell, and support — unified under one high-performance roof.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.id}
                className={`p-7 rounded-3xl bg-white border border-neutral-200/90 hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 flex flex-col justify-between space-y-6 ${pillar.bgLight}`}
              >
                <div className="space-y-4">
                  {/* Top Bar: Icon + Num & Category */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${pillar.color} text-white flex items-center justify-center shadow-md shrink-0`}>
                        <Icon size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-neutral-400">{pillar.num}</span>
                          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 font-mono">
                            {pillar.category}
                          </span>
                        </div>
                        <p className={`text-[11px] font-semibold ${pillar.accentText} mt-0.5`}>
                          {pillar.tagline}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 tracking-tight leading-snug">
                      {pillar.title}
                    </h3>
                    <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">
                      {pillar.valueProp}
                    </p>
                  </div>

                  {/* Real-World Metric Badge */}
                  <div className="pt-1">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg ${pillar.badgeBg}`}>
                      <Sparkles size={12} className="shrink-0" />
                      {pillar.metricBadge}
                    </span>
                  </div>

                  {/* 4 Architectural Features */}
                  <div className="space-y-2.5 pt-3 border-t border-neutral-200/70 text-xs text-neutral-700">
                    {pillar.features.map((feat, idx) => {
                      const [featureTitle, ...featureRest] = feat.split(': ');
                      const featureDesc = featureRest.join(': ');
                      return (
                        <div key={idx} className="flex items-start gap-2 leading-relaxed">
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>
                            {featureDesc ? (
                              <>
                                <strong className="font-semibold text-neutral-900">{featureTitle}:</strong>{" "}
                                <span className="text-neutral-600">{featureDesc}</span>
                              </>
                            ) : (
                              <span>{feat}</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-200/80">
                  <Link
                    href={pillar.link}
                    className="text-xs font-bold text-neutral-900 hover:text-blue-600 transition flex items-center justify-between group"
                  >
                    <span>{pillar.linkText}</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── THE OLD WAY vs. WITH nORBIT (Side-by-Side Comparison) ─────────── */}
      <section id="comparison" className="py-24 bg-white border-y border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-semibold">
              <Layers size={13} /> The Philosophy
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight font-[Space_Grotesk]">
              The Old Way vs. With nORBIT
            </h2>
            <p className="text-neutral-600 text-base sm:text-lg max-w-2xl mx-auto">
              Eliminate software dependency. Consolidate fragmented bills into one sovereign ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch max-w-5xl mx-auto">
            {/* The Old Way */}
            <div className="p-8 sm:p-10 rounded-3xl bg-neutral-50 border border-neutral-200/90 flex flex-col justify-between space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold mb-4">
                  <X size={14} /> THE OLD WAY
                </div>
                <h3 className="text-2xl font-bold text-neutral-900">8+ Disconnected SaaS Tools</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Expensive monthly bills, fragmented user identities, and constant data silos.
                </p>

                <div className="divide-y divide-neutral-200/70 mt-6 text-xs">
                  {oldWaySaaS.map((s, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span className="font-semibold text-neutral-800">{s.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-rose-600 font-bold">{s.cost}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs text-rose-800 space-y-1">
                <p className="font-bold">Total Cost: ₹40,000 - ₹1,20,000 / month</p>
                <p className="text-[11px] text-rose-700">Zero true data ownership • Fragile webhook glue • Vulnerable to price hikes.</p>
              </div>
            </div>

            {/* With nORBIT */}
            <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-b from-blue-50/80 to-white border-2 border-blue-500/30 flex flex-col justify-between space-y-6 shadow-xl shadow-blue-900/5 relative">
              <div className="absolute top-6 right-6">
                <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-bold shadow-xs">
                  Recommended
                </span>
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-4">
                  <Check size={14} className="text-emerald-700" /> WITH nORBIT
                </div>
                <h3 className="text-2xl font-bold text-neutral-900">One Sovereign Platform</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Unified identity, zero external dependency, and complete cryptographic tenant isolation.
                </p>

                <div className="space-y-3.5 mt-6 text-xs text-neutral-700">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-neutral-200/80 shadow-2xs">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-neutral-900">Single Sign-On &amp; Unified Identity</p>
                      <p className="text-neutral-500 text-[11px]">One user account for projects, CRM, tickets, attendance, and billing.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-neutral-200/80 shadow-2xs">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-neutral-900">Automated PostgreSQL Event Mesh</p>
                      <p className="text-neutral-500 text-[11px]">Zero webhook breakages. Tasks, invoices, and server alerts sync instantly.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-neutral-200/80 shadow-2xs">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-neutral-900">100% Data Sovereignty (DPDP Compliant)</p>
                      <p className="text-neutral-500 text-[11px]">Your data stays on your sovereign infrastructure or dedicated cloud cluster.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-neutral-200/80 shadow-2xs">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-neutral-900">Self-Hosted Docker or Managed Cloud</p>
                      <p className="text-neutral-500 text-[11px]">Complete deployment freedom without proprietary vendor lock-in.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  href="/register"
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition"
                >
                  Switch to nORBIT Today <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Architecture & Dual-Plane Isolation ───────────────────────────── */}
      <section id="architecture" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              <ShieldCheck size={14} /> Zero-Trust Security Architecture
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight font-[Space_Grotesk]">
              Architected for sovereign multi-tenancy &amp; zero data leakage
            </h2>
            <p className="text-neutral-600 text-sm leading-relaxed">
              Every customer organization operates inside an encrypted tenant boundary. Cross-tenant
              queries are stopped at the ORM layer, static attachments require session-bound cryptographic
              authorization, and internal staff operations remain completely air-gapped on{" "}
              <code className="text-blue-700 text-xs font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">teams.neuravolt.in</code>.
            </p>

            <div className="space-y-3.5 pt-2 text-xs text-neutral-700">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Tenant Scoping at DB Level:</strong> Projects, tasks, clients, invoices,
                  and tickets enforce strict foreign keys to Organization ID.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Dual-Plane RBAC:</strong> Customer Owners and Admins manage their own
                  teams without possessing staff privileges on the internal plane.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Authenticated Attachment Streams:</strong> Private PDFs, tax invoices, and
                  customer ticket attachments are streamed via authenticated endpoints.
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-neutral-200/90 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl shadow-blue-900/5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <span className="text-xs font-mono text-neutral-500 font-semibold">Dual-Plane Ingress Topology</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Boundary Isolation Active
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs text-neutral-800 bg-neutral-50 p-5 rounded-2xl border border-neutral-200/80">
              <div className="text-neutral-400">// Dual Ingress Gateways</div>
              <div className="flex justify-between py-1 border-b border-neutral-200/60">
                <span className="text-blue-600 font-semibold">norbit.neuravolt.in</span>
                <span className="text-neutral-500">Customer Multi-Tenant SaaS</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-200/60">
                <span className="text-purple-600 font-semibold">teams.neuravolt.in</span>
                <span className="text-neutral-500">Internal Sovereign Operations</span>
              </div>
              <div className="pt-2 text-neutral-400">// Defense-in-Depth Authorization</div>
              <div className="flex justify-between py-1 border-b border-neutral-200/60">
                <span className="text-amber-600 font-semibold">Tenant Context</span>
                <span className="text-neutral-500">JWT + Organization Claims</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-emerald-600 font-semibold">Data Crossover</span>
                <span className="text-emerald-700 font-bold">Blocked at ORM Layer</span>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center text-xs text-neutral-500 font-medium">
              <span>Stack: Next.js 16 • NestJS 11 • PostgreSQL 16 • Redis 7</span>
              <Link href="/community" className="text-blue-600 hover:underline font-bold">
                View Architecture →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Community Open Source Callout ─────────────────────────────────── */}
      <section className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/70 border border-neutral-200/90 rounded-3xl p-10 sm:p-14 space-y-6 shadow-xl shadow-blue-900/5">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
            <Terminal size={24} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight font-[Space_Grotesk]">
            Self-Host with Single-Tenant Docker
          </h2>
          <p className="text-neutral-600 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Need an on-premise installation for strict government or defense compliance? NORBIT
            Community Edition is 100% free and ready to deploy with a 60-second setup wizard.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/community"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm transition shadow-md shadow-blue-500/25"
            >
              Open Community Quickstart Guide <ArrowRight size={16} />
            </Link>
            <a
              href="https://github.com/neuravolt/norbit"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-800 font-semibold text-sm transition shadow-2xs"
            >
              Star on GitHub <ExternalLink size={14} className="text-neutral-400" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Official NeuraVolt Enterprise Footer (Matching neuravolt.in) ──── */}
      <footer className="border-t border-neutral-200/90 bg-white pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Col 1: About & Slogan */}
            <div className="lg:col-span-2 space-y-4">
              <Link href="/" className="inline-block">
                <img
                  src="/brand/norbit-logo.png"
                  alt="nORBIT"
                  className="h-10 w-auto object-contain select-none"
                />
              </Link>
              <p className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                VOLTNOVATE SOLUTIONS LLP
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed max-w-sm">
                Technology is becoming more powerful, but increasingly fragmented. NeuraVolt exists to bring it together into one integrated ecosystem, continuously evolving through innovation.
              </p>
              <p className="text-xs font-semibold text-neutral-600 italic">
                &ldquo;Intelligent Solutions. Measurable Impact.&rdquo;
              </p>
            </div>

            {/* Col 2: The 6 Pillars */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-neutral-900 uppercase tracking-wider font-mono">
                6 Sovereign Pillars
              </p>
              <ul className="space-y-2 text-xs text-neutral-600">
                <li><a href="#pillars" className="hover:text-blue-600 transition">01. Guardian SRE &amp; Cyber Shield</a></li>
                <li><a href="#pillars" className="hover:text-blue-600 transition">02. DevOps Delivery &amp; Scope Creep</a></li>
                <li><a href="#pillars" className="hover:text-blue-600 transition">03. NeuraCollect Cash Flow Ledger</a></li>
                <li><a href="#pillars" className="hover:text-blue-600 transition">04. Team Chat, Mailbox &amp; MeetPass</a></li>
                <li><a href="#pillars" className="hover:text-blue-600 transition">05. Workforce HRM &amp; Dynamic RBAC</a></li>
                <li><a href="#pillars" className="hover:text-blue-600 transition">06. White-Label Client Portal</a></li>
              </ul>
            </div>

            {/* Col 3: Product & Plans */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-neutral-900 uppercase tracking-wider font-mono">
                Product &amp; Deployment
              </p>
              <ul className="space-y-2 text-xs text-neutral-600">
                <li><Link href="/register" className="hover:text-blue-600 transition">Cloud SaaS Registration</Link></li>
                <li><Link href="/login" className="hover:text-blue-600 transition">Workspace Sign In</Link></li>
                <li><Link href="/community" className="hover:text-blue-600 transition">Self-Hosted Docker</Link></li>
                <li><Link href="/settings/billing" className="hover:text-blue-600 transition">Plans &amp; Subscription</Link></li>
                <li><a href="https://teams.neuravolt.in" className="hover:text-blue-600 transition">Internal Sovereign Team</a></li>
              </ul>
            </div>

            {/* Col 4: Corporate Contact */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-neutral-900 uppercase tracking-wider font-mono">
                Offices &amp; Contact
              </p>
              <div className="space-y-2 text-xs text-neutral-600">
                <p><strong>Headquarters:</strong> E Block, 511, Amity Innovation Center, Gwalior, MP - 474020, India</p>
                <p><strong>Regional Office:</strong> Sector 23A, Gurugram, Haryana - 122017, India</p>
                <p className="pt-1">
                  <strong>Email:</strong>{" "}
                  <a href="mailto:info@neuravolt.in" className="text-blue-600 hover:underline">
                    info@neuravolt.in
                  </a>
                </p>
                <p>
                  <strong>Phone:</strong>{" "}
                  <a href="tel:+919202243725" className="text-blue-600 hover:underline">
                    +91 9202243725
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
            <p>
              © {new Date().getFullYear()} NeuraVolt Technology (VOLTNOVATE SOLUTIONS LLP). All rights reserved.
            </p>

            <div className="flex items-center gap-6">
              <a
                href="https://www.linkedin.com/company/neuravolt-technology/posts/?feedView=all"
                target="_blank"
                rel="noreferrer"
                className="hover:text-blue-600 transition"
              >
                LinkedIn
              </a>
              <a
                href="https://instagram.com/we.neuravolt"
                target="_blank"
                rel="noreferrer"
                className="hover:text-blue-600 transition"
              >
                Instagram
              </a>
              <a
                href="https://github.com/neuravolt-technologies"
                target="_blank"
                rel="noreferrer"
                className="hover:text-blue-600 transition"
              >
                GitHub
              </a>
              <a
                href="https://www.google.com/maps/place/Neuravolt+Technology/data=!4m2!3m1!1s0x0:0x47b13dd0dbd4c8f5"
                target="_blank"
                rel="noreferrer"
                className="hover:text-blue-600 transition"
              >
                Google Maps
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}


// ─── Main Dashboard (Dual-Plane Ingress) ──────────────────────────────────────

export default function Dashboard() {
  const { user, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Dual-Plane Ingress: Only unauthenticated guests see the public SaaS landing page
  if (!isAuthenticated) {
    return <NorbitEnterpriseLandingPage user={user} isCustomer={false} />;
  }

  const userRole = (user as any)?.role;

  // Sovereign Staff Plane: Route to staff role-specific dashboards
  if (userRole === "DEVELOPER" || userRole === "QA") {
    return <DevQADashboard user={user} />;
  }
  if (userRole === "SUPPORT") {
    return <SupportDashboard user={user} />;
  }
  if (userRole === "ACCOUNTANT") {
    return <AccountantDashboard user={user} />;
  }
  return <AdminDashboard user={user} />;
}

// ─── Admin/Manager: full business overview ────────────────────────────────
function AdminDashboard({ user }: { user: any }) {
  const { data: projectsData } = useProjects({ limit: 5, status: 'ACTIVE' });
  const { data: allProjects } = useProjects({ limit: 1 });
  const { data: openTickets } = useTickets({ status: 'OPEN', limit: 1 });
  const { data: criticalTickets } = useTickets({ status: 'OPEN', priority: 'CRITICAL', limit: 1 });
  const { data: amcDue } = useAmcRenewalsDue();
  const { data: invoicesData } = useInvoices({ limit: 50 });
  const { data: clientsData } = useClients({ limit: 1 });
  const { data: leadsData } = useLeads({ limit: 1 });
  const { data: quotesData } = useQuotes({ limit: 50 });
  const { data: amcData } = useAmcContracts({ status: 'ACTIVE', limit: 50 });
  const { data: tasksData } = useTasks();

  const totalProjects = allProjects?.total ?? 0;
  const openTicketCount = openTickets?.total ?? 0;
  const criticalCount = criticalTickets?.total ?? 0;
  const amcExpiring = Array.isArray(amcDue) ? amcDue.length : 0;
  const totalClients = clientsData?.total ?? 0;
  const totalLeads = leadsData?.total ?? 0;
  const totalTasks = Array.isArray(tasksData) ? tasksData.length : (tasksData as any)?.total ?? (tasksData as any)?.tasks?.length ?? 0;

  const invoices = invoicesData?.invoices ?? [];
  const quotes = quotesData?.quotes ?? [];
  const contracts = amcData?.contracts ?? [];

  const totalRevenue = invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.grandTotal ?? 0), 0);
  const outstanding = invoices.filter((i: any) => ['sent', 'partial_paid'].includes(i.status)).reduce((s: number, i: any) => s + Number(i.balanceDue ?? 0), 0);
  const overdueAmount = invoices.filter((i: any) => i.status === 'overdue').reduce((s: number, i: any) => s + Number(i.balanceDue ?? 0), 0);
  const overdueCount = invoices.filter((i: any) => i.status === 'overdue').length;

  const openQuotes = quotes.filter((q: any) => ['DRAFT', 'SENT'].includes(q.status));
  const openQuotesValue = openQuotes.reduce((s: number, q: any) => s + Number(q.grandTotal ?? 0), 0);

  const totalAmcMonthly = contracts.reduce((s: number, c: any) => s + Number(c.monthlyValue ?? 0), 0);

  const recentProjects = projectsData?.projects?.slice(0, 5) ?? [];
  const recentInvoices = invoices.slice(0, 5);

  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? 'Good morning' : greetHour < 17 ? 'Good afternoon' : 'Good evening';

  // Trends from the invoices already loaded (the latest 50): value per day, paid vs not yet paid.
  const invDate = (i: any) => new Date(i.issueDate || i.invoiceDate || i.createdAt).getTime();
  const days = dayBuckets(invoices, invDate, 14);
  const invoiceTrend = days.map((d) => ({
    label: d.label,
    values: {
      paid: Math.round(d.items.filter((i: any) => i.status === 'paid').reduce((n: number, i: any) => n + Number(i.grandTotal ?? 0), 0)),
      open: Math.round(d.items.filter((i: any) => i.status !== 'paid' && i.status !== 'draft').reduce((n: number, i: any) => n + Number(i.balanceDue ?? i.grandTotal ?? 0), 0)),
    },
  }));
  const paidSeries = days.map((d) => d.items.filter((i: any) => i.status === 'paid').reduce((n: number, i: any) => n + Number(i.grandTotal ?? 0), 0));
  const openSeries = days.map((d) => d.items.filter((i: any) => ['sent', 'partial_paid', 'overdue'].includes(i.status)).length);
  const quoteSeries = dayBuckets(quotes, (q: any) => new Date(q.createdAt).getTime(), 14).map((d) => d.items.length);
  const statusCounts: Record<string, number> = {};
  for (const inv of invoices) statusCounts[inv.status || 'unknown'] = (statusCounts[inv.status || 'unknown'] || 0) + 1;
  const STATUS_COLOR: Record<string, string> = { paid: '#10b981', sent: '#3b82f6', partial_paid: '#8b5cf6', overdue: '#ef4444', draft: '#94a3b8', cancelled: '#64748b' };

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto space-y-5">
        <PageHeader
          icon={LayoutDashboard}
          title={<>{greeting}, {user?.firstName ?? 'there'} 👋</>}
          subtitle={`Business overview · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
          actions={<>
            <Link href="/sales" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FileText className="w-4 h-4" /> New quote</Link>
            <Link href="/billing" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-500"><Receipt className="w-4 h-4" /> Generate invoice</Link>
          </>}
        />

        {/* What needs attention */}
        {(overdueCount > 0 || amcExpiring > 0 || criticalCount > 0) && (
          <div className="flex flex-wrap gap-2">
            {overdueCount > 0 && (
              <Link href="/billing?status=overdue" className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100">
                <AlertTriangle className="w-4 h-4" /> {overdueCount} overdue invoice{overdueCount > 1 ? 's' : ''} · {fmt(overdueAmount)} <ChevronRight className="w-4 h-4" />
              </Link>
            )}
            {amcExpiring > 0 && (
              <Link href="/amc" className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100">
                <Clock className="w-4 h-4" /> {amcExpiring} AMC{amcExpiring > 1 ? 's' : ''} expiring soon <ChevronRight className="w-4 h-4" />
              </Link>
            )}
            {criticalCount > 0 && (
              <Link href="/tickets?priority=CRITICAL" className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100">
                <AlertTriangle className="w-4 h-4" /> {criticalCount} critical ticket{criticalCount > 1 ? 's' : ''} <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        )}

        {/* Money */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Link href="/billing"><KpiCard tone="ok" icon={CheckCircle2} value={fmt(totalRevenue)} label="Revenue collected" delta={{ text: 'paid invoices' }} series={paidSeries} /></Link>
          <Link href="/billing"><KpiCard tone="info" icon={Clock} value={fmt(outstanding)} label="Outstanding" delta={{ text: 'sent and part-paid' }} series={openSeries} /></Link>
          <Link href="/sales"><KpiCard tone="violet" icon={FileText} value={fmt(openQuotesValue)} label="Open quotations" delta={{ text: `${openQuotes.length} active quote${openQuotes.length === 1 ? '' : 's'}` }} series={quoteSeries} /></Link>
          <Link href="/amc"><KpiCard tone="warning" icon={Activity} value={fmt(totalAmcMonthly)} label="AMC per month" delta={{ text: `${contracts.length} active contract${contracts.length === 1 ? '' : 's'}` }} /></Link>
        </div>

        {/* Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1.5fr_1.1fr_1fr] gap-3">
          <ChartCard title="Invoiced value (14 days)" action={<Link href="/billing" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Billing →</Link>}>
            <StackedBars buckets={invoiceTrend} labelEvery={3} series={[{ key: 'paid', label: 'Paid (₹)', color: '#10b981' }, { key: 'open', label: 'Not yet paid (₹)', color: '#3b82f6' }]} />
          </ChartCard>
          <ChartCard title="Invoices by status">
            <Donut centerLabel="Invoices" segments={Object.entries(statusCounts).map(([k, v]) => ({ label: k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), value: v, color: STATUS_COLOR[k] || '#94a3b8' }))} />
          </ChartCard>
          <ChartCard title="Quotations by status" action={<Link href="/sales" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Quotes →</Link>}>
            <BarList empty="No quotations yet." items={['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].map((k, i) => ({ label: k.charAt(0) + k.slice(1).toLowerCase(), value: quotes.filter((q: any) => q.status === k).length, color: ['#94a3b8', '#3b82f6', '#10b981', '#ef4444', '#f59e0b'][i] })).filter((x) => x.value > 0)} />
          </ChartCard>
        </div>

        {/* Quick navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Clients', value: totalClients, icon: Building2, href: '/clients' },
            { label: 'Leads', value: totalLeads, icon: TrendingUp, href: '/leads' },
            { label: 'Projects', value: totalProjects, icon: FolderOpen, href: '/projects' },
            { label: 'Tasks', value: totalTasks, icon: CheckSquare, href: '/tasks' },
            { label: 'Open tickets', value: openTicketCount, icon: AlertTriangle, href: '/tickets' },
            { label: 'AMC contracts', value: contracts.length, icon: Clock, href: '/amc' },
            { label: 'Invoices', value: invoices.length, icon: Receipt, href: '/billing' },
          ].map((x) => (
            <Link key={x.label} href={x.href} className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition">
              <x.icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
              <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">{x.value}</p>
              <p className="text-xs font-medium text-slate-500">{x.label}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <TableCard title="Active projects" icon={FolderOpen} toolbar={<Link href="/projects" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">View all <ArrowRight className="w-3.5 h-3.5" /></Link>}>
            {recentProjects.length === 0 ? (
              <EmptyBlock icon={FolderOpen} title="No active projects" action={<Link href="/projects" className="text-sm font-semibold text-indigo-600">Create a project</Link>} />
            ) : (
              <table className="w-full">
                <thead><tr><th className={th}>Project</th><th className={th}>Client</th><th className={th}>Due</th><th className={th}>Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {recentProjects.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className={td}><Link href="/projects" className="font-semibold text-slate-900 hover:text-indigo-600">{p.name}</Link></td>
                      <td className={td}>{p.client?.name ?? 'Internal'}</td>
                      <td className={`${td} whitespace-nowrap`}>{fmtDate(p.dueDate)}</td>
                      <td className={td}><Badge tone={statusTone(p.status)}>{String(p.status).replace(/_/g, ' ')}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableCard>
          <TableCard title="Recent invoices" icon={Receipt} toolbar={<Link href="/billing" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">View all <ArrowRight className="w-3.5 h-3.5" /></Link>}>
            {recentInvoices.length === 0 ? (
              <EmptyBlock icon={Receipt} title="No invoices yet" action={<Link href="/billing" className="text-sm font-semibold text-indigo-600">Create an invoice</Link>} />
            ) : (
              <table className="w-full">
                <thead><tr><th className={th}>Invoice</th><th className={th}>Client</th><th className={`${th} text-right`}>Amount</th><th className={th}>Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {recentInvoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50/60">
                      <td className={td}><Link href="/billing" className="font-mono font-semibold text-indigo-600 hover:text-indigo-800">{inv.invoiceNumber}</Link></td>
                      <td className={td}>{inv.client?.name ?? 'Direct customer'}</td>
                      <td className={`${td} text-right font-semibold text-slate-900 tabular-nums`}>{fmt(inv.grandTotal)}</td>
                      <td className={td}><Badge tone={statusTone(inv.status)}>{String(inv.status).replace(/_/g, ' ')}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableCard>
        </div>

        <ChartCard title="Quick actions">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'New quotation', icon: FileText, href: '/sales' },
              { label: 'Service catalog', icon: Layers, href: '/service-catalog' },
              { label: 'Billing & invoicing', icon: Receipt, href: '/billing' },
              { label: 'Company settings', icon: Building2, href: '/settings' },
            ].map((a) => (
              <Link key={a.label} href={a.href} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-700 transition">
                <a.icon className="w-5 h-5 text-indigo-600" /> {a.label}
              </Link>
            ))}
          </div>
        </ChartCard>
      </div>
    </PageShell>
  );
}

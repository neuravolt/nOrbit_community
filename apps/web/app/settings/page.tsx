'use client';
import Link from 'next/link';
import { Building2, Layers, Shield, ArrowRight, ClipboardList, CreditCard, Settings, GitBranch, Sparkles } from 'lucide-react';
import { PageShell, PageHeader } from '../../src/components/ui/page';

export default function SettingsHubPage() {
  const settingsCards = [
    {
      title: 'SaaS Plans & Subscriptions',
      description: 'Dynamic plan CRUD, tier limits, pricing, and customer organization overrides.',
      href: '/admin/plans',
      icon: Sparkles,
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      title: 'Company Profile',
      description: 'Legal name, address, bank and tax details, logo, signature and stamp.',
      href: '/settings/company',
      icon: Building2,
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      title: 'Payment Gateway (Cashfree)',
      description: 'Cashfree keys, webhook secret, sandbox or live mode, online checkout and manual verification.',
      href: '/settings/payments',
      icon: CreditCard,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      title: 'GitHub Integration',
      description: 'Centralized GitHub Apps for Projects & Launchpad, encrypted credentials, webhooks, and connection testing.',
      href: '/settings/integrations/github',
      icon: GitBranch,
      color: 'text-violet-600 bg-violet-50',
    },
    {
      title: 'Service Catalog',
      description: 'Services you sell, rate cards per client tier and bundles.',
      href: '/settings/service-catalog',
      icon: Layers,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      title: 'Roles & Permissions',
      description: 'Roles and what each one is allowed to do.',
      href: '/settings/roles',
      icon: Shield,
      color: 'text-rose-600 bg-rose-50',
    },
    {
      title: 'System Audit Logs',
      description: 'Who changed what, and every scheduled job run (overdue invoice flags, AMC generation).',
      href: '/settings/audit-logs',
      icon: ClipboardList,
      color: 'text-teal-600 bg-teal-50',
    },
  ];

  return (
    <PageShell>
      <PageHeader icon={Settings} title="Settings" subtitle="Company details, payments, catalog, access and audit history." />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {settingsCards.map(card => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="group bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-200 hover:shadow-sm transition flex items-start gap-3"
            >
              <div className={`p-2.5 rounded-lg shrink-0 ${card.color}`}><Icon size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600">{card.title}</h2>
                  <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-500 shrink-0" />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mt-1">{card.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}

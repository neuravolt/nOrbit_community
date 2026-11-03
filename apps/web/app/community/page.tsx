"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Globe,
  Layers,
  Rocket,
  Server,
  Shield,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

function GithubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

const DOCKER_COMPOSE_SNIPPET = `version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: norbit-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: norbit_community
      POSTGRES_USER: norbit
      POSTGRES_PASSWORD: \${DB_PASSWORD:-norbit_secret_vault_2026}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U norbit -d norbit_community"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: norbit-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass \${REDIS_PASSWORD:-norbit_redis_2026}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  api:
    image: ghcr.io/neuravolt/norbit-api:latest
    container_name: norbit-api
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://norbit:\${DB_PASSWORD:-norbit_secret_vault_2026}@db:5432/norbit_community?schema=public
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: \${REDIS_PASSWORD:-norbit_redis_2026}
      JWT_SECRET: \${JWT_SECRET:-generate_random_64_char_secret_key_here}
      JWT_EXPIRES_IN: 86400s
      SERVE_STATIC_UPLOADS: "true"
    ports:
      - "4000:4000"

  web:
    image: ghcr.io/neuravolt/norbit-web:latest
    container_name: norbit-web
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NODE_ENV: production
      PORT: 3000
      NEXT_PUBLIC_API_URL: http://localhost:4000
    ports:
      - "3000:3000"

volumes:
  postgres_data:
  redis_data:`;

export default function CommunityPage() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(DOCKER_COMPOSE_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition">
                N
              </div>
              <span className="text-xl font-black tracking-tight text-white font-[Space_Grotesk]">
                nORBIT
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Community
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
              <a href="#quickstart" className="hover:text-white transition">Quickstart</a>
              <a href="#architecture" className="hover:text-white transition">Architecture</a>
              <a href="#comparison" className="hover:text-white transition">Community vs Cloud</a>
              <a
                href="https://github.com/neuravolt/norbit"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition flex items-center gap-1.5"
              >
                GitHub <ExternalLink size={13} />
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl transition shadow-lg shadow-indigo-600/30"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.2),transparent_60%)] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <Sparkles size={14} /> Open-Source Sovereign Edition
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight font-[Space_Grotesk] leading-tight">
            Self-host NORBIT in seconds on your own metal
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            Own 100% of your business data. Deploy our full ERP, CRM, project management, and billing microservices stack with a single Docker Compose manifest.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href="#quickstart"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30"
            >
              <Terminal size={18} /> Quickstart Guide <ArrowRight size={16} />
            </a>
            <a
              href="https://github.com/neuravolt/norbit"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-semibold text-sm transition"
            >
              <GithubIcon className="w-4 h-4" /> View on GitHub <ExternalLink size={14} className="text-slate-400" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Quickstart Section ────────────────────────────────────────────── */}
      <section id="quickstart" className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-4 mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Terminal className="text-indigo-400" /> Single-Tenant Quickstart Guide
          </h2>
          <p className="text-slate-400 text-sm">
            Follow this 3-step guide to run NORBIT Community Edition on any Linux, macOS, or Windows host with Docker.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              1
            </span>
            <h3 className="font-bold text-white text-base">Clone & Configure</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Clone the open-source repository and copy the environment template.
            </p>
            <div className="bg-slate-950 p-2.5 rounded-lg font-mono text-[11px] text-slate-300">
              git clone https://github.com/neuravolt/norbit.git
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              2
            </span>
            <h3 className="font-bold text-white text-base">Launch Containers</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Execute Docker Compose to bring up Postgres, Redis, NestJS, and Next.js.
            </p>
            <div className="bg-slate-950 p-2.5 rounded-lg font-mono text-[11px] text-slate-300">
              docker compose up -d
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              3
            </span>
            <h3 className="font-bold text-white text-base">Open Dashboard</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Visit your local instance in any browser and create your initial admin account.
            </p>
            <div className="bg-slate-950 p-2.5 rounded-lg font-mono text-[11px] text-indigo-400 font-semibold">
              http://localhost:3000
            </div>
          </div>
        </div>

        {/* Compose Manifest */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-mono text-slate-400 ml-2">docker-compose.yml</span>
            </div>
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy Manifest
                </>
              )}
            </button>
          </div>
          <pre className="p-5 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed max-h-[420px] custom-scrollbar">
            {DOCKER_COMPOSE_SNIPPET}
          </pre>
        </div>
      </section>

      {/* ── Architecture Section ─────────────────────────────────────────── */}
      <section id="architecture" className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Production-Tested Microservices Architecture
          </h2>
          <p className="text-slate-400 text-sm max-w-2xl mx-auto">
            NORBIT combines enterprise-grade TypeScript across the full stack with high-throughput persistent storage.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Layers size={20} />
            </div>
            <h3 className="font-bold text-white text-base">Next.js 14 Frontend</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              React 18 app directory, TailwindCSS design tokens, TanStack Query cache, and WebSocket real-time updates.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Cpu size={20} />
            </div>
            <h3 className="font-bold text-white text-base">NestJS Microservices</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Modular controllers, DTO validation with class-validator, JWT dual-plane guards, and RBAC matrix.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Database size={20} />
            </div>
            <h3 className="font-bold text-white text-base">PostgreSQL 16 &amp; Prisma</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Relational schemas with strong foreign key guarantees, indexed query plans, and safe additive migration files.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <Zap size={20} />
            </div>
            <h3 className="font-bold text-white text-base">Redis 7 Broker</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              High-throughput in-memory rate limiting, BullMQ async jobs, PubSub events, and session token storage.
            </p>
          </div>
        </div>
      </section>

      {/* ── Comparison Table ────────────────────────────────────────────── */}
      <section id="comparison" className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Community Edition vs NORBIT Enterprise Cloud
          </h2>
          <p className="text-slate-400 text-sm max-w-2xl mx-auto">
            Choose the deployment tier that matches your compliance, engineering, and support needs.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-300 font-semibold">
                  <th className="py-4 px-6">Capability / Feature</th>
                  <th className="py-4 px-6 text-center text-slate-300">Community Edition</th>
                  <th className="py-4 px-6 text-center text-indigo-400 font-bold bg-indigo-500/10">
                    NORBIT Enterprise Cloud
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr>
                  <td className="py-4 px-6 font-medium">Deployment Topology</td>
                  <td className="py-4 px-6 text-center text-slate-400">Single-Tenant Self-Hosted</td>
                  <td className="py-4 px-6 text-center font-semibold text-emerald-400 bg-indigo-500/5">
                    Multi-Tenant Sovereign Cloud
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium">Projects, Tasks &amp; CRM Pipeline</td>
                  <td className="py-4 px-6 text-center text-emerald-400">Included</td>
                  <td className="py-4 px-6 text-center font-semibold text-emerald-400 bg-indigo-500/5">
                    Included + Automation
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium">Dual-GST Billing &amp; Invoicing</td>
                  <td className="py-4 px-6 text-center text-emerald-400">Standard</td>
                  <td className="py-4 px-6 text-center font-semibold text-emerald-400 bg-indigo-500/5">
                    Automated E-Invoicing &amp; Cashfree
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium">Autonomous SRE (Guardian)</td>
                  <td className="py-4 px-6 text-center text-slate-500">Manual Operations</td>
                  <td className="py-4 px-6 text-center font-semibold text-emerald-400 bg-indigo-500/5">
                    Continuous Health &amp; Failover
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium">Multi-Tenancy &amp; Org Switcher</td>
                  <td className="py-4 px-6 text-center text-slate-500">Single Org Only</td>
                  <td className="py-4 px-6 text-center font-semibold text-emerald-400 bg-indigo-500/5">
                    Unlimited Multi-Tenant Orgs
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium">Uptime SLA &amp; Dedicated Support</td>
                  <td className="py-4 px-6 text-center text-slate-500">Community Forum</td>
                  <td className="py-4 px-6 text-center font-semibold text-emerald-400 bg-indigo-500/5">
                    99.99% SLA + 24/7 Engineers
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Call To Action ────────────────────────────────────────────────── */}
      <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-gradient-to-r from-indigo-900/60 via-slate-900 to-indigo-950/60 border border-indigo-500/30 rounded-3xl p-10 sm:p-14 space-y-6 shadow-2xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-[Space_Grotesk]">
            Prefer a zero-maintenance managed cloud?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Get instant access to our managed Indian cloud cluster with automated daily backups, high-availability replication, and instant payment gateways.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30"
            >
              Start 14-Day Free Cloud Trial <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition"
            >
              Sign In to Existing Workspace
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-900 py-10 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} NeuraVolt Technologies. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-slate-300 transition">Platform</Link>
            <Link href="/community" className="hover:text-slate-300 transition">Community</Link>
            <Link href="/login" className="hover:text-slate-300 transition">Customer Sign In</Link>
            <a
              href="https://github.com/neuravolt/norbit"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

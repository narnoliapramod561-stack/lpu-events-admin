// lpu-events-admin/src/components/superadmin/monitoring/MonitoringPanel.tsx
// Super Admin Monitoring Master Panel & Section Router (MON-004 / MON-008 Stage 8)

import React, { useState } from 'react';
import {
  Activity,
  Inbox,
  Radio,
  FileCode2,
  Search,
} from 'lucide-react';
import { MonitoringOverview } from './sections/MonitoringOverview.tsx';
import { ErrorInbox } from './sections/ErrorInbox.tsx';
import { ServicesStatus } from './sections/ServicesStatus.tsx';
import { BackendLogsPanel } from './sections/BackendLogsPanel.tsx';

export type MonitoringSubSection = 'overview' | 'inbox' | 'services' | 'logs' | 'seo';

export const MonitoringPanel: React.FC = () => {
  const [activeSection, setActiveSection] = useState<MonitoringSubSection>('overview');
  const [selectedCorrelationId, setSelectedCorrelationId] = useState<string>('');

  const navItems = [
    {
      id: 'overview' as const,
      label: 'Section A: Overview',
      shortLabel: 'Overview',
      icon: Activity,
      desc: 'Platform status & provider health',
    },
    {
      id: 'inbox' as const,
      label: 'Section B: Error Inbox',
      shortLabel: 'Error Inbox',
      icon: Inbox,
      desc: 'PostHog issues & exception triage',
    },
    {
      id: 'services' as const,
      label: 'Section C: Services Status',
      shortLabel: 'Services Status',
      icon: Radio,
      desc: 'Real-time UptimeRobot probes',
    },
    {
      id: 'logs' as const,
      label: 'Section D: Backend Logs',
      shortLabel: 'Backend Logs',
      icon: FileCode2,
      desc: 'ClickHouse runtime log explorer',
    },
    {
      id: 'seo' as const,
      label: 'Section E: SEO Health',
      shortLabel: 'SEO Health',
      icon: Search,
      desc: 'Google Search Console telemetry',
      stage: 'Stage 13',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-[#252528] border border-zinc-200/80 dark:border-white/10">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white dark:bg-white/10 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.shortLabel}</span>
              {item.stage && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-200/60 dark:bg-white/10 text-zinc-500 dark:text-zinc-400 font-mono font-normal">
                  {item.stage}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Render Active Monitoring Section */}
      {activeSection === 'overview' && (
        <MonitoringOverview onNavigateToSection={(s) => setActiveSection(s as MonitoringSubSection)} />
      )}

      {activeSection === 'inbox' && (
        <ErrorInbox
          onSearchLogs={(correlationId) => {
            setSelectedCorrelationId(correlationId);
            setActiveSection('logs');
          }}
        />
      )}

      {activeSection === 'services' && (
        <ServicesStatus />
      )}

      {activeSection === 'logs' && (
        <BackendLogsPanel initialCorrelationId={selectedCorrelationId} />
      )}

      {activeSection === 'seo' && (
        <div className="p-12 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 text-center space-y-3">
          <Search className="w-10 h-10 text-purple-500 mx-auto" />
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">
            Section E: SEO & Google Search Console
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Scheduled for <strong>Stage 13</strong>. Will surface search analytics, click-through rates, average search positions, and sitemap indexing status.
          </p>
        </div>
      )}
    </div>
  );
};

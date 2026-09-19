import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  id?: string;
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accent?: 'emerald' | 'amber' | 'blue' | 'purple' | 'stone';
  badgeText?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  id,
  title,
  value,
  subtitle,
  icon: Icon,
  accent = 'stone',
  badgeText,
}) => {
  const accentClasses = {
    emerald: 'text-emerald-700 bg-emerald-50/90 border-emerald-200/70 ring-1 ring-emerald-500/10',
    amber: 'text-amber-800 bg-amber-50/90 border-amber-200/70 ring-1 ring-amber-500/10',
    blue: 'text-sky-700 bg-sky-50/90 border-sky-200/70 ring-1 ring-sky-500/10',
    purple: 'text-indigo-700 bg-indigo-50/90 border-indigo-200/70 ring-1 ring-indigo-500/10',
    stone: 'text-stone-700 bg-stone-100/90 border-stone-200/70 ring-1 ring-stone-500/10',
  };

  return (
    <div
      id={id}
      className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">{title}</span>
        <div className={`p-2.5 rounded-xl border ${accentClasses[accent]} shadow-2xs`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-bold font-mono text-stone-900 tracking-tight">
          {value}
        </div>
        {(subtitle || badgeText) && (
          <div className="flex items-center gap-2 mt-2 text-xs text-stone-500">
            {badgeText && (
              <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[11px]">
                {badgeText}
              </span>
            )}
            {subtitle && <span className="truncate">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

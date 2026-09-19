import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  id?: string;
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  id,
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div
      id={id}
      className="p-10 text-center rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 flex flex-col items-center justify-center max-w-lg mx-auto shadow-2xs"
    >
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 mb-3.5 shadow-2xs">
        <Icon className="w-7 h-7" />
      </div>
      <h4 className="text-base font-bold text-stone-900">{title}</h4>
      <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs cursor-pointer active:scale-98"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

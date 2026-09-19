import React from 'react';
import { InventoryMovementType, SaleStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
}) => {
  const variantStyles = {
    default: 'bg-stone-100 text-stone-800 border-stone-200',
    neutral: 'bg-stone-100 text-stone-700 border-stone-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-sm font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border tracking-tight whitespace-nowrap ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
};

export const MovementTypeBadge: React.FC<{ type: InventoryMovementType }> = ({ type }) => {
  switch (type) {
    case 'STOCK_IN':
      return <Badge variant="success">Stock In</Badge>;
    case 'SALE':
      return <Badge variant="info">Sale</Badge>;
    case 'ADJUSTMENT':
      return <Badge variant="warning">Adjustment</Badge>;
    case 'RETURN':
      return <Badge variant="neutral">Return</Badge>;
    default:
      return <Badge variant="neutral">{type}</Badge>;
  }
};

export const SaleStatusBadge: React.FC<{ status: SaleStatus }> = ({ status }) => {
  switch (status) {
    case 'COMPLETED':
      return <Badge variant="success">Completed</Badge>;
    case 'REFUNDED':
      return <Badge variant="warning">Refunded</Badge>;
    case 'VOID':
      return <Badge variant="danger">Voided</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};

import React from 'react';
import { CreditCard, Apple, Clock, Check } from 'lucide-react';
import { cn } from '../ui/utils';

export type PaymentMethod = 'card' | 'apple_pay' | 'pay_after';

interface PaymentOptionProps {
  id: PaymentMethod;
  title: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: (id: PaymentMethod) => void;
  disabled?: boolean;
}

const PaymentOption = ({ id, title, description, icon, selected, onSelect, disabled }: PaymentOptionProps) => {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(id)}
      disabled={disabled}
      className={cn(
        'group relative flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200',
        disabled
          ? 'cursor-not-allowed opacity-60 bg-slate-50'
          : selected
            ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      )}
    >
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors',
          selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-slate-900">{title}</h4>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all',
          selected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
        )}
      >
        {selected && <Check className="h-4 w-4 text-white" />}
      </div>
    </button>
  );
};

interface PaymentSelectorProps {
  value: PaymentMethod | '';
  onChange: (value: PaymentMethod) => void;
}

export const PaymentSelector = ({ value, onChange }: PaymentSelectorProps) => {
  return (
    <div className="space-y-3">
      <PaymentOption
        id="pay_after"
        title="Pay After Service"
        description="Pay when service is completed"
        icon={<Clock className="h-6 w-6" />}
        selected={value === 'pay_after'}
        onSelect={onChange}
      />
      <PaymentOption
        id="card"
        title="Credit / Debit Card"
        description="Pay securely with your card"
        icon={<CreditCard className="h-6 w-6" />}
        selected={value === 'card'}
        onSelect={onChange}
        disabled
      />
      <PaymentOption
        id="apple_pay"
        title="Apple Pay"
        description="Fast and secure payment"
        icon={<Apple className="h-6 w-6" />}
        selected={value === 'apple_pay'}
        onSelect={onChange}
        disabled
      />
    </div>
  );
};

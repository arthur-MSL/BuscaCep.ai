import React from 'react';

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  width?: string;
  id?: string;
  type?: string;
}

export const InputField: React.FC<InputFieldProps> = ({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  width = 'w-full',
  id,
  type = 'text'
}) => {
  const safeId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={`flex flex-col ${width}`}>
      <label 
        htmlFor={safeId} 
        className="text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider"
      >
        {label}
      </label>
      <input
        id={safeId}
        type={type}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-slate-800 placeholder-slate-400 text-sm font-medium"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
};
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-body-sm font-medium mb-2">
          {label}
        </label>
      )}
      <input
        className={`input ${error ? 'border-error' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-caption text-error mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-caption text-dark-text-secondary mt-1">{helperText}</p>
      )}
    </div>
  );
};

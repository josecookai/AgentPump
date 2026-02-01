import React from 'react';

interface CardProps {
  children: React.ReactNode;
  hover?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  hover = false,
  className = '',
  onClick,
}) => {
  const baseClass = hover ? 'card-hover' : 'card';
  
  return (
    <div
      className={`${baseClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

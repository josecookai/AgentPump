import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showLabel = false,
  className = '',
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={className}>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-caption text-dark-text-secondary mt-1">
          {clampedProgress.toFixed(1)}%
        </p>
      )}
    </div>
  );
};

import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useThemeLanguage } from '../context/ThemeLanguageContext';

interface OptimisticLockingBannerProps {
  message: string;
  onReload: () => void;
  onDismiss?: () => void;
}

export const OptimisticLockingBanner: React.FC<OptimisticLockingBannerProps> = ({
  message,
  onReload,
  onDismiss,
}) => {
  const { t } = useThemeLanguage();

  return (
    <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4 flex items-start justify-between gap-3 shadow-lg backdrop-blur-sm animate-pulse-slow">
      <div className="flex items-start space-x-3">
        <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-amber-700 dark:text-amber-300 text-sm">
            {t('optimisticConflictTitle')}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            {message || t('optimisticConflictDesc')}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onReload}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t('reload')}</span>
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

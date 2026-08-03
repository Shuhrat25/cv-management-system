import React from 'react';
import { Trash2, Edit3, Eye, Copy, CheckSquare, Plus } from 'lucide-react';

interface TableToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll?: () => void;
  isAllSelected?: boolean;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCreateNew?: () => void;
  createButtonLabel?: string;
  customActions?: React.ReactNode;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  isAllSelected,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onCreateNew,
  createButtonLabel = 'Create New',
  customActions,
}) => {
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm mb-4 transition-all">
      {/* Selection Summary */}
      <div className="flex items-center space-x-3">
        {onSelectAll && (
          <button
            onClick={onSelectAll}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
            <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
          </button>
        )}

        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {selectedCount > 0 ? (
            <span className="font-bold text-blue-600 dark:text-blue-400">{selectedCount} item(s) selected</span>
          ) : (
            `Showing ${totalCount} total record(s)`
          )}
        </span>
      </div>

      {/* Context Actions (Appears dynamically when items selected or toolbar ready) */}
      <div className="flex items-center space-x-2">
        {selectedCount > 0 && (
          <div className="flex items-center space-x-2 bg-blue-600/10 dark:bg-blue-500/10 p-1 rounded-xl border border-blue-500/20 animate-fade-in">
            {selectedCount === 1 && onView && (
              <button
                onClick={onView}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </button>
            )}

            {selectedCount === 1 && onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white shadow hover:bg-amber-700 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            {selectedCount === 1 && onDuplicate && (
              <button
                onClick={onDuplicate}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white shadow hover:bg-indigo-700 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicate</span>
              </button>
            )}

            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white shadow hover:bg-rose-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedCount})</span>
              </button>
            )}
          </div>
        )}

        {customActions}

        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{createButtonLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};

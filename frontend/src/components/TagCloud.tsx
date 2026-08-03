import React from 'react';
import { Tag } from 'lucide-react';

interface TagCloudProps {
  tags: Array<{ tag: string; count: number }>;
  onSelectTag?: (tag: string) => void;
  selectedTag?: string;
}

export const TagCloud: React.FC<TagCloudProps> = ({ tags, onSelectTag, selectedTag }) => {
  if (!tags || tags.length === 0) return null;

  const maxCount = Math.max(...tags.map((t) => t.count), 1);

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
      <div className="w-full flex items-center space-x-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
        <Tag className="w-3.5 h-3.5 text-blue-500" />
        <span>Technology Tags Cloud</span>
      </div>

      {tags.map(({ tag, count }) => {
        const isSelected = selectedTag === tag;
        // Dynamic scale based on tag popularity frequency
        const scale = 0.75 + (count / maxCount) * 0.45;

        return (
          <button
            key={tag}
            onClick={() => onSelectTag && onSelectTag(isSelected ? '' : tag)}
            style={{ fontSize: `${scale}rem` }}
            className={`px-3 py-1 rounded-full font-bold transition-all ${
              isSelected
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105'
                : 'bg-slate-100 hover:bg-blue-50 text-slate-700 dark:bg-slate-800/80 dark:hover:bg-blue-900/40 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60'
            }`}
          >
            #{tag} <span className="text-[10px] opacity-75 font-normal">({count})</span>
          </button>
        );
      })}
    </div>
  );
};

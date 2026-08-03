import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { useThemeLanguage } from '../context/ThemeLanguageContext';
import { TagCloud } from '../components/TagCloud';
import { TableToolbar } from '../components/TableToolbar';
import {
  FileText,
  Briefcase,
  Users,
  ShieldCheck,
  TrendingUp,
  Clock,
  Flame,
  ArrowRight,
  Eye,
  CheckCircle,
  Sparkles,
} from 'lucide-react';

interface StatsData {
  stats: {
    cvsLast24h: number;
    totalPositions: number;
    totalCandidates: number;
    totalRecruiters: number;
    totalCVs: number;
  };
  latestPositions: any[];
  mostPopularPositions: any[];
  tagCloud: Array<{ tag: string; count: number }>;
}

export const DashboardPage: React.FC = () => {
  const { t } = useThemeLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedLatestPosId, setSelectedLatestPosId] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await apiRequest<StatsData>('/stats');
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { stats, latestPositions, mostPopularPositions, tagCloud } = data;

  const filteredPositions = selectedTag
    ? latestPositions.filter((p) => {
        try {
          const tags: string[] = JSON.parse(p.projectTagsJson || '[]');
          return tags.includes(selectedTag);
        } catch (e) {
          return false;
        }
      })
    : latestPositions;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white p-8 md:p-12 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Smart Candidate & Position Matching Platform</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Reusable Attributes & Automated CV Generation
          </h1>
          <p className="text-slate-200 text-sm md:text-base leading-relaxed">
            Create customizable position templates, build reusable candidate profiles, and assemble dynamically formatted CVs in seconds.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => navigate('/positions')}
              className="px-6 py-3 bg-white text-blue-700 font-extrabold text-xs rounded-xl shadow-lg hover:bg-slate-100 transition-all flex items-center space-x-2"
            >
              <span>Browse All Positions</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Public Statistics Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{stats.cvsLast24h}</div>
            <div className="text-[11px] text-slate-500 font-semibold">{t('statsCVs24h')}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{stats.totalPositions}</div>
            <div className="text-[11px] text-slate-500 font-semibold">{t('statsTotalPositions')}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{stats.totalCandidates}</div>
            <div className="text-[11px] text-slate-500 font-semibold">{t('statsTotalCandidates')}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{stats.totalRecruiters}</div>
            <div className="text-[11px] text-slate-500 font-semibold">{t('statsTotalRecruiters')}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{stats.totalCVs}</div>
            <div className="text-[11px] text-slate-500 font-semibold">{t('statsSubmittedCVs')}</div>
          </div>
        </div>
      </div>

      {/* Interactive Technology Tag Cloud */}
      <TagCloud tags={tagCloud} selectedTag={selectedTag} onSelectTag={setSelectedTag} />

      {/* Latest Positions Table View (Strict Table Compliance) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{t('latestPositions')}</h2>
          </div>
          {selectedTag && (
            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-bold px-3 py-1 rounded-full">
              Filtered by Tag: #{selectedTag}
            </span>
          )}
        </div>

        <TableToolbar
          selectedCount={selectedLatestPosId ? 1 : 0}
          totalCount={filteredPositions.length}
          onView={selectedLatestPosId ? () => navigate(`/positions/${selectedLatestPosId}`) : undefined}
          onCreateNew={() => navigate('/positions')}
          createButtonLabel="Browse Positions Table"
        />

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="p-4 w-12 text-center">Select</th>
                <th className="p-4">Position Title</th>
                <th className="p-4">Created By</th>
                <th className="p-4 text-center">Submitted CVs</th>
                <th className="p-4">Project Tags</th>
                <th className="p-4 text-right">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filteredPositions.map((pos) => {
                const isSelected = selectedLatestPosId === pos.id;
                const tags: string[] = JSON.parse(pos.projectTagsJson || '[]');

                return (
                  <tr
                    key={pos.id}
                    onClick={() => setSelectedLatestPosId(isSelected ? null : pos.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-500/10 dark:bg-blue-500/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => setSelectedLatestPosId(isSelected ? null : pos.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{pos.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{pos.description}</div>
                    </td>
                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                      {pos.createdBy?.name || 'Recruiter'}
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {pos._count.cvs} CVs
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-right text-xs text-slate-400 font-medium">
                      {new Date(pos.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Most Popular Positions Table View */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center space-x-2">
          <Flame className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{t('popularPositions')}</h2>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="p-4 w-12 text-center">Rank</th>
                <th className="p-4">Position Title</th>
                <th className="p-4">Recruiter</th>
                <th className="p-4 text-center">Total CV Submissions</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {mostPopularPositions.map((pos, idx) => (
                <tr key={pos.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 text-center font-extrabold text-slate-400">#{idx + 1}</td>
                  <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{pos.title}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">{pos.createdBy?.name}</td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{pos._count.cvs} CVs</span>
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => navigate(`/positions/${pos.id}`)}
                      className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

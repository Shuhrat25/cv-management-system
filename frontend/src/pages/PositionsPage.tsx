import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useThemeLanguage } from '../context/ThemeLanguageContext';
import { TableToolbar } from '../components/TableToolbar';
import { OptimisticLockingBanner } from '../components/OptimisticLockingBanner';
import { Briefcase, Plus, Search, CheckCircle2, AlertTriangle, Copy, Trash2, Eye, ShieldCheck, X } from 'lucide-react';

interface Position {
  id: string;
  title: string;
  description: string;
  isPublic: boolean;
  accessRulesJson: string;
  projectTagsJson: string;
  maxProjects: number;
  apiToken: string;
  version: number;
  createdAt: string;
  createdBy: { name: string };
  attributes: Array<{ attributeId: string; attribute: { id: string; name: string } }>;
  _count: { cvs: number };
  isEligible?: boolean;
  failedRules?: string[];
}

interface Attribute {
  id: string;
  name: string;
  category: { name: string };
}

export const PositionsPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useThemeLanguage();
  const navigate = useNavigate();

  const [positions, setPositions] = useState<Position[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Optimistic locking error
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Modal Form for Create Position
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    projectTagsStr: 'Python, SQL, React',
    maxProjects: 3,
    selectedAttrIds: [] as string[],
    accessRules: [] as Array<{ attributeId: string; attributeName: string; operator: string; value: string }>,
  });

  const fetchPositions = async () => {
    setLoading(true);
    try {
      const candidateParam = user?.role === 'CANDIDATE' ? `?candidateId=${user.id}` : '';
      const [posList, attrList] = await Promise.all([
        apiRequest<Position[]>(`/positions${candidateParam}`),
        apiRequest<Attribute[]>('/attributes'),
      ]);
      setPositions(posList);
      setAttributes(attrList);
      setConflictError(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [user]);

  const handleDuplicate = async () => {
    if (!selectedId) return;
    try {
      await apiRequest(`/positions/${selectedId}/duplicate`, { method: 'POST' });
      setSelectedId(null);
      fetchPositions();
    } catch (e: any) {
      alert(e.error || 'Failed to duplicate position');
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const pos = positions.find((p) => p.id === selectedId);
    if (!pos) return;

    if (!confirm(`Delete position "${pos.title}"?`)) return;

    try {
      await apiRequest(`/positions/${selectedId}`, {
        method: 'DELETE',
        body: JSON.stringify({ version: pos.version }),
      });
      setSelectedId(null);
      fetchPositions();
    } catch (err: any) {
      if (err.currentVersion !== undefined || err.error?.includes('Optimistic')) {
        setConflictError(err.error || 'Optimistic locking conflict on position deletion.');
      } else {
        alert(err.error || 'Failed to delete position');
      }
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tags = createForm.projectTagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await apiRequest('/positions', {
        method: 'POST',
        body: JSON.stringify({
          title: createForm.title,
          description: createForm.description,
          projectTags: tags,
          maxProjects: createForm.maxProjects,
          attributes: createForm.selectedAttrIds,
          accessRules: createForm.accessRules,
        }),
      });

      setShowCreateModal(false);
      fetchPositions();
    } catch (e: any) {
      alert(e.error || 'Failed to create position');
    }
  };

  const filteredPositions = positions.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Briefcase className="w-6 h-6 text-blue-500" />
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{t('positions')}</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Recruiter-configured position templates defining required candidate attributes, access rules, and project filters.
          </p>
        </div>
      </div>

      {conflictError && (
        <OptimisticLockingBanner message={conflictError} onReload={fetchPositions} onDismiss={() => setConflictError(null)} />
      )}

      {/* Search Filter */}
      <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search positions by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Toolbar (Strict Table View Requirement) */}
      <TableToolbar
        selectedCount={selectedId ? 1 : 0}
        totalCount={filteredPositions.length}
        onView={selectedId ? () => navigate(`/positions/${selectedId}`) : undefined}
        onDuplicate={user?.role === 'RECRUITER' || user?.role === 'ADMIN' ? handleDuplicate : undefined}
        onDelete={user?.role === 'RECRUITER' || user?.role === 'ADMIN' ? handleDelete : undefined}
        onCreateNew={user?.role === 'RECRUITER' || user?.role === 'ADMIN' ? () => setShowCreateModal(true) : undefined}
        createButtonLabel="Create Blank Position"
      />

      {/* STRICT TABLE REPRESENTATION FOR POSITIONS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th className="p-4 w-12 text-center">Select</th>
              <th className="p-4">Position Title & Template</th>
              <th className="p-4">Access Eligibility</th>
              <th className="p-4">Required Attributes</th>
              <th className="p-4 text-center">Submitted CVs</th>
              <th className="p-4 text-center">Version</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            {filteredPositions.map((pos) => {
              const isSelected = selectedId === pos.id;

              return (
                <tr
                  key={pos.id}
                  onClick={() => setSelectedId(isSelected ? null : pos.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-500/10 dark:bg-blue-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => setSelectedId(isSelected ? null : pos.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{pos.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{pos.description}</div>
                  </td>

                  {/* Candidate Qualification Status */}
                  <td className="p-4">
                    {user?.role === 'CANDIDATE' ? (
                      pos.isEligible ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Qualified</span>
                        </span>
                      ) : (
                        <span
                          title={pos.failedRules?.join(', ')}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Action Required</span>
                        </span>
                      )
                    ) : (
                      <span className="text-xs font-medium text-slate-500">Public Rule Template</span>
                    )}
                  </td>

                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {pos.attributes.slice(0, 3).map((pa) => (
                        <span
                          key={pa.attributeId}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        >
                          {pa.attribute.name}
                        </span>
                      ))}
                      {pos.attributes.length > 3 && (
                        <span className="text-[10px] text-slate-400 font-bold">+{pos.attributes.length - 3} more</span>
                      )}
                    </div>
                  </td>

                  <td className="p-4 text-center">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {pos._count.cvs} CVs
                    </span>
                  </td>

                  <td className="p-4 text-center">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 rounded">
                      v{pos.version}
                    </span>
                  </td>

                  <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/positions/${pos.id}`)}
                      className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow"
                    >
                      View Template
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create Position Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">Create Position Template</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Position Title</label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g. Senior Data Analyst @ Acme Corp"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Role overview and responsibilities..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Matching Project Tags (comma separated)</label>
                  <input
                    type="text"
                    value={createForm.projectTagsStr}
                    onChange={(e) => setCreateForm({ ...createForm, projectTagsStr: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Max Projects in CV</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={createForm.maxProjects}
                    onChange={(e) => setCreateForm({ ...createForm, maxProjects: parseInt(e.target.value) || 3 })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Required Attributes from Library
                </label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 space-y-1">
                  {attributes.map((a) => {
                    const isChecked = createForm.selectedAttrIds.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{a.name}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const newIds = isChecked
                              ? createForm.selectedAttrIds.filter((id) => id !== a.id)
                              : [...createForm.selectedAttrIds, a.id];
                            setCreateForm({ ...createForm, selectedAttrIds: newIds });
                          }}
                          className="rounded border-slate-300 text-blue-600"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700"
                >
                  Create Position
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

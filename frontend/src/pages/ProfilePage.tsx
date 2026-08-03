import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useThemeLanguage } from '../context/ThemeLanguageContext';
import { OptimisticLockingBanner } from '../components/OptimisticLockingBanner';
import { CloudImageUploader } from '../components/CloudImageUploader';
import { AchievementsPanel } from '../components/AchievementsPanel';
import {
  User as UserIcon,
  MapPin,
  Mail,
  Plus,
  Trash2,
  Edit3,
  Save,
  CheckCircle2,
  Layers,
  Briefcase,
  FileText,
  Clock,
  Sparkles,
  X,
  Tag,
} from 'lucide-react';

interface CandidateProfileData {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    location: string;
    avatarUrl: string;
    version: number;
  };
  attributeValues: Array<{
    id: string;
    attributeId: string;
    value: string;
    version: number;
    attribute: { id: string; name: string; dataType: string; optionsJson?: string; category: { name: string } };
  }>;
  projects: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate?: string;
    description: string;
    tagsJson: string;
    version: number;
  }>;
  cvs: Array<{
    id: string;
    isPublished: boolean;
    position: { id: string; title: string };
    _count: { likes: number };
  }>;
}

interface Attribute {
  id: string;
  name: string;
  dataType: string;
  category: { name: string };
  optionsJson?: string;
}

export const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, refreshUser } = useAuth();
  const { t } = useThemeLanguage();
  const navigate = useNavigate();

  const targetUserId = userId || currentUser?.id;
  const isOwner = currentUser?.id === targetUserId;
  const isAdmin = currentUser?.role === 'ADMIN';
  const isReadOnly = !isOwner && !isAdmin;

  const [profile, setProfile] = useState<CandidateProfileData | null>(null);
  const [availableAttributes, setAvailableAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);

  // Active section tab
  const [activeTab, setActiveTab] = useState<'me' | 'info' | 'projects' | 'cvs'>('me');

  // Me section edit state
  const [meForm, setMeForm] = useState({ name: '', location: '', avatarUrl: '', version: 1 });

  // Info section attribute values map
  const [attrValuesState, setAttrValuesState] = useState<Record<string, { value: string; version: number }>>({});
  const [selectedAttrToAdd, setSelectedAttrToAdd] = useState('');

  // Auto-save status
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [conflictError, setConflictError] = useState<string | null>(null);
  const isDirtyRef = useRef(false);

  // Project Modal State
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [projectForm, setProjectForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    description: '',
    tagsInput: '',
    version: 1,
  });

  const fetchProfile = async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const [prof, attrs] = await Promise.all([
        apiRequest<CandidateProfileData>(`/profile/${targetUserId}`),
        apiRequest<Attribute[]>('/attributes'),
      ]);

      setProfile(prof);
      setAvailableAttributes(attrs);
      setMeForm({
        name: prof.user.name,
        location: prof.user.location || '',
        avatarUrl: prof.user.avatarUrl || '',
        version: prof.user.version,
      });

      const map: Record<string, { value: string; version: number }> = {};
      prof.attributeValues.forEach((av) => {
        map[av.attributeId] = { value: av.value, version: av.version };
      });
      setAttrValuesState(map);
      setConflictError(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [targetUserId]);

  // Auto-Save background timer (runs every 7 seconds if dirty and owner/admin)
  useEffect(() => {
    if (isReadOnly) return;
    const autoSaveInterval = setInterval(() => {
      if (isDirtyRef.current) {
        performAutoSave();
      }
    }, 7000);

    return () => clearInterval(autoSaveInterval);
  }, [attrValuesState, targetUserId, isReadOnly]);

  const performAutoSave = async () => {
    if (isReadOnly) return;
    setAutoSaveStatus('saving');
    try {
      const items = Object.entries(attrValuesState).map(([attributeId, item]) => ({
        attributeId,
        value: item.value,
        version: item.version,
      }));

      const res = await apiRequest('/profile/attribute-values/auto-save', {
        method: 'POST',
        body: JSON.stringify({ items, candidateId: targetUserId }),
      });

      // Update versions from saved results
      if (res.savedResults) {
        setAttrValuesState((prev) => {
          const updated = { ...prev };
          res.savedResults.forEach((r: any) => {
            updated[r.attributeId] = { value: r.value, version: r.version };
          });
          return updated;
        });
      }

      isDirtyRef.current = false;
      setAutoSaveStatus('saved');
    } catch (err: any) {
      setAutoSaveStatus('error');
      if (err.conflicts || err.currentVersion !== undefined) {
        setConflictError(err.error || 'Optimistic locking auto-save conflict.');
      }
    }
  };

  const handleMeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/profile/me', {
        method: 'PUT',
        body: JSON.stringify(meForm),
      });
      refreshUser();
      fetchProfile();
    } catch (err: any) {
      if (err.currentVersion !== undefined) {
        setConflictError(err.error || 'Optimistic locking conflict on profile save.');
      } else {
        alert(err.error || 'Failed to update Me section');
      }
    }
  };

  const handleAttrChange = (attributeId: string, val: string) => {
    setAttrValuesState((prev) => ({
      ...prev,
      [attributeId]: { value: val, version: prev[attributeId]?.version || 1 },
    }));
    isDirtyRef.current = true;
  };

  const handleAddAttributeToInfo = (attributeId: string) => {
    if (!attributeId) return;
    setAttrValuesState((prev) => ({
      ...prev,
      [attributeId]: { value: '', version: 1 },
    }));
    setSelectedAttrToAdd('');
    isDirtyRef.current = true;
  };

  const handleRemoveAttributeFromInfo = (attributeId: string) => {
    setAttrValuesState((prev) => {
      const copy = { ...prev };
      delete copy[attributeId];
      return copy;
    });
    isDirtyRef.current = true;
  };

  // Projects CRUD
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tags = projectForm.tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (editingProject) {
        await apiRequest(`/profile/projects/${editingProject.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: projectForm.name,
            startDate: projectForm.startDate,
            endDate: projectForm.endDate,
            description: projectForm.description,
            tags,
            version: projectForm.version,
          }),
        });
      } else {
        await apiRequest('/profile/projects', {
          method: 'POST',
          body: JSON.stringify({
            name: projectForm.name,
            startDate: projectForm.startDate,
            endDate: projectForm.endDate,
            description: projectForm.description,
            tags,
          }),
        });
      }

      setShowProjectModal(false);
      fetchProfile();
    } catch (err: any) {
      alert(err.error || 'Failed to save project');
    }
  };

  const handleDeleteProject = async (projId: string) => {
    if (!confirm('Delete this project?')) return;
    try {
      await apiRequest(`/profile/projects/${projId}`, { method: 'DELETE' });
      fetchProfile();
    } catch (err: any) {
      alert(err.error || 'Failed to delete project');
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const activeAttrIds = Object.keys(attrValuesState);
  const activeAttributes = availableAttributes.filter((a) => activeAttrIds.includes(a.id));
  const totalLikes = profile.cvs.reduce((acc, c) => acc + (c._count?.likes || 0), 0);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Profile Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <img
            src={profile.user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'}
            alt={profile.user.name}
            className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-500/30 shadow-lg"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{profile.user.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {profile.user.role}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <Mail className="w-3.5 h-3.5" />
                <span>{profile.user.email}</span>
              </span>
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{profile.user.location}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Auto-Save indicator banner */}
        {!isReadOnly && (
          <div className="flex items-center space-x-3">
            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                autoSaveStatus === 'saved'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : autoSaveStatus === 'saving'
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{autoSaveStatus === 'saved' ? 'Auto-Saved (5-10s)' : autoSaveStatus === 'saving' ? 'Auto-Saving...' : 'Save Error'}</span>
            </span>

            <button
              onClick={performAutoSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 flex items-center space-x-1"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Now</span>
            </button>
          </div>
        )}
      </div>

      {conflictError && (
        <OptimisticLockingBanner message={conflictError} onReload={fetchProfile} onDismiss={() => setConflictError(null)} />
      )}

      {/* Badges / Achievements SVG Panel */}
      <AchievementsPanel
        userName={profile.user.name}
        projectsCount={profile.projects.length}
        cvsCount={profile.cvs.length}
        likesCount={totalLikes}
      />

      {/* Profile Section Navigation (Me, Info, Projects, CVs) */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6">
        <button
          onClick={() => setActiveTab('me')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'me'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Me (Mandatory Attributes)
        </button>

        <button
          onClick={() => setActiveTab('info')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'info'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Info (Library Attributes - {activeAttributes.length})
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'projects'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Projects ({profile.projects.length})
        </button>

        <button
          onClick={() => setActiveTab('cvs')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'cvs'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          My CVs ({profile.cvs.length})
        </button>
      </div>

      {/* Section 1: Me (Mandatory built-in attributes) */}
      {activeTab === 'me' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 max-w-xl">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">Mandatory Built-In Attributes</h3>
          <form onSubmit={handleMeSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={meForm.name}
                onChange={(e) => setMeForm({ ...meForm, name: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Location</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={meForm.location}
                onChange={(e) => setMeForm({ ...meForm, location: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            {!isReadOnly && (
              <CloudImageUploader
                label="Personal Profile Photo (Drag-n-Drop External Cloud Storage)"
                value={meForm.avatarUrl}
                onChange={(url) => setMeForm({ ...meForm, avatarUrl: url })}
              />
            )}

            {!isReadOnly && (
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl shadow hover:bg-blue-700"
              >
                Save Built-In Attributes (v{meForm.version})
              </button>
            )}
          </form>
        </div>
      )}

      {/* Section 2: Info (User Selected Attributes from Library) */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          {!isReadOnly && (
            <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center space-x-3 max-w-lg">
              <select
                value={selectedAttrToAdd}
                onChange={(e) => setSelectedAttrToAdd(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              >
                <option value="">Select attribute from library to add...</option>
                {availableAttributes
                  .filter((a) => !activeAttrIds.includes(a.id))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.category.name})
                    </option>
                  ))}
              </select>
              <button
                onClick={() => handleAddAttributeToInfo(selectedAttrToAdd)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Attribute</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAttributes.map((attr) => {
              const currentItem = attrValuesState[attr.id] || { value: '', version: 1 };
              let options: string[] = [];
              if (attr.optionsJson) {
                try {
                  options = JSON.parse(attr.optionsJson);
                } catch (e) {}
              }

              return (
                <div key={attr.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-2 shadow-sm relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{attr.name}</h4>
                      <span className="text-[10px] text-slate-400 font-semibold">{attr.category.name}</span>
                    </div>
                    {!isReadOnly && (
                      <button
                        onClick={() => handleRemoveAttributeFromInfo(attr.id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {attr.dataType === 'ONE_OF_MANY' ? (
                    <select
                      disabled={isReadOnly}
                      value={currentItem.value}
                      onChange={(e) => handleAttrChange(attr.id, e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    >
                      <option value="">Select option...</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : attr.dataType === 'BOOLEAN' ? (
                    <label className="flex items-center space-x-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={currentItem.value === 'true'}
                        onChange={(e) => handleAttrChange(attr.id, String(e.target.checked))}
                        className="rounded border-slate-300 text-blue-600 w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Yes / Available</span>
                    </label>
                  ) : attr.dataType === 'IMAGE' ? (
                    <CloudImageUploader
                      value={currentItem.value}
                      onChange={(url) => handleAttrChange(attr.id, url)}
                    />
                  ) : (
                    <input
                      type={attr.dataType === 'NUMERIC' ? 'number' : 'text'}
                      disabled={isReadOnly}
                      value={currentItem.value}
                      onChange={(e) => handleAttrChange(attr.id, e.target.value)}
                      placeholder={`Enter ${attr.name}...`}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 3: Projects */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          {!isReadOnly && (
            <button
              onClick={() => {
                setEditingProject(null);
                setProjectForm({ name: '', startDate: '', endDate: '', description: '', tagsInput: '', version: 1 });
                setShowProjectModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 hover:bg-blue-700 flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add Candidate Project</span>
            </button>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.projects.map((proj) => {
              const tags: string[] = JSON.parse(proj.tagsJson || '[]');
              return (
                <div key={proj.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100">{proj.name}</h4>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {proj.startDate} — {proj.endDate || 'Present'}
                      </span>
                    </div>

                    {!isReadOnly && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setEditingProject(proj);
                            setProjectForm({
                              name: proj.name,
                              startDate: proj.startDate,
                              endDate: proj.endDate || '',
                              description: proj.description,
                              tagsInput: tags.join(', '),
                              version: proj.version,
                            });
                            setShowProjectModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-500"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteProject(proj.id)} className="p-1.5 text-slate-400 hover:text-rose-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 prose dark:prose-invert max-w-none">
                    <ReactMarkdown>{proj.description}</ReactMarkdown>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 4: CVs */}
      {activeTab === 'cvs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="p-4">Position CV Title</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Likes</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {profile.cvs.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{c.position.title}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${c.isPublished ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                      {c.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="p-4 text-center font-bold text-rose-500">{c._count.likes}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => navigate(`/cvs/${c.id}`)} className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700">
                      Open CV Page
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                {editingProject ? 'Edit Project' : 'Add Candidate Project'}
              </h3>
              <button onClick={() => setShowProjectModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={projectForm.startDate}
                    onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">End Date (optional)</label>
                  <input
                    type="date"
                    value={projectForm.endDate}
                    onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Technology Tags (comma separated)</label>
                <input
                  type="text"
                  value={projectForm.tagsInput}
                  onChange={(e) => setProjectForm({ ...projectForm, tagsInput: e.target.value })}
                  placeholder="e.g. Python, SQL, React, Node"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Description (Markdown Supported)</label>
                <textarea
                  rows={4}
                  required
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="Project architecture and outcomes..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl shadow hover:bg-blue-700">
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

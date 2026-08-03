import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useThemeLanguage } from '../context/ThemeLanguageContext';
import { IntegrationsModal } from '../components/IntegrationsModal';
import {
  Briefcase,
  Layers,
  MessageSquare,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Send,
  Download,
  Share2,
  Clock,
  Heart,
  User as UserIcon,
} from 'lucide-react';

interface PositionDetail {
  id: string;
  title: string;
  description: string;
  isPublic: boolean;
  accessRulesJson: string;
  projectTagsJson: string;
  maxProjects: number;
  apiToken: string;
  version: number;
  createdBy: { name: string; email: string };
  attributes: Array<{
    id: string;
    isRequired: boolean;
    attribute: { id: string; name: string; dataType: string; category: { name: string } };
  }>;
  cvs: Array<{
    id: string;
    isPublished: boolean;
    createdAt: string;
    candidate: { id: string; name: string; email: string; location: string };
    _count: { likes: number };
  }>;
  discussions: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; name: string; role: string; avatarUrl?: string };
  }>;
}

export const PositionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useThemeLanguage();

  const [position, setPosition] = useState<PositionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'template' | 'cvs' | 'discussions'>('template');

  // Discussion post input
  const [discussionInput, setDiscussionInput] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Candidate qualification evaluation
  const [isEligible, setIsEligible] = useState(true);
  const [failedRules, setFailedRules] = useState<string[]>([]);

  // Odoo modal
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);

  const fetchPosition = async () => {
    if (!id) return;
    try {
      const data = await apiRequest<PositionDetail>(`/positions/${id}`);
      setPosition(data);

      // Evaluate candidate access rules if logged in as candidate
      if (user?.role === 'CANDIDATE') {
        const rules = JSON.parse(data.accessRulesJson || '[]');
        if (rules.length > 0) {
          const profile = await apiRequest(`/profile/${user.id}`);
          const attrValsMap = new Map<string, string>();
          (profile.attributeValues || []).forEach((v: any) => attrValsMap.set(v.attributeId, v.value));

          const failed: string[] = [];
          for (const r of rules) {
            const actual = attrValsMap.get(r.attributeId);
            let passed = false;
            if (actual !== undefined && actual !== null && actual !== '') {
              if (r.operator === 'EQ') passed = String(actual).toLowerCase() === String(r.value).toLowerCase();
              else if (r.operator === 'GTE') passed = parseFloat(actual) >= parseFloat(r.value);
              else if (r.operator === 'LTE') passed = parseFloat(actual) <= parseFloat(r.value);
            }
            if (!passed) failed.push(`${r.attributeName || 'Attribute'} (${r.operator} ${r.value})`);
          }

          setIsEligible(failed.length === 0);
          setFailedRules(failed);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosition();
  }, [id, user]);

  // Real-time Discussion Polling (2-5s requirement from PDF Section 10)
  useEffect(() => {
    if (activeTab !== 'discussions' || !id) return;
    const interval = setInterval(async () => {
      try {
        const posts = await apiRequest(`/discussions/position/${id}`);
        setPosition((prev) => (prev ? { ...prev, discussions: posts } : null));
      } catch (e) {}
    }, 3000);

    return () => clearInterval(interval);
  }, [activeTab, id]);

  const handleGenerateCv = async () => {
    if (!id || !user) return;
    try {
      const res = await apiRequest<{ cvId: string }>('/cvs/generate', {
        method: 'POST',
        body: JSON.stringify({ positionId: id }),
      });
      navigate(`/cvs/${res.cvId}`);
    } catch (err: any) {
      alert(err.error || 'Failed to generate CV');
    }
  };

  const handlePostDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discussionInput.trim() || !id) return;
    setIsPosting(true);
    try {
      const post = await apiRequest(`/discussions/position/${id}`, {
        method: 'POST',
        body: JSON.stringify({ content: discussionInput }),
      });
      setPosition((prev) => (prev ? { ...prev, discussions: [...prev.discussions, post] } : null));
      setDiscussionInput('');
    } catch (err: any) {
      alert(err.error || 'Failed to post message');
    } finally {
      setIsPosting(false);
    }
  };

  const handleExportCsv = () => {
    if (!position || !position.cvs) return;
    const headers = ['CV_ID', 'Candidate_Name', 'Candidate_Email', 'Location', 'Likes_Count', 'Status'];
    const rows = position.cvs.map((c) => [
      c.id,
      `"${c.candidate.name}"`,
      c.candidate.email,
      `"${c.candidate.location}"`,
      c._count.likes,
      c.isPublished ? 'Published' : 'Draft',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${position.title.replace(/\s+/g, '_')}_CVs_Analysis.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !position) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const projectTags: string[] = JSON.parse(position.projectTagsJson || '[]');

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                Position Template v{position.version}
              </span>
              <span className="text-xs text-slate-400">Created by {position.createdBy.name}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100">{position.title}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{position.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user?.role === 'CANDIDATE' && (
              <button
                onClick={handleGenerateCv}
                disabled={!isEligible}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center space-x-2 ${
                  isEligible
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20'
                    : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate CV for Position</span>
              </button>
            )}

            {(user?.role === 'RECRUITER' || user?.role === 'ADMIN') && (
              <>
                <button
                  onClick={() => setShowIntegrationsModal(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5"
                >
                  <Share2 className="w-4 h-4 text-blue-500" />
                  <span>Odoo API Token</span>
                </button>

                <button
                  onClick={handleExportCsv}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5"
                >
                  <Download className="w-4 h-4 text-emerald-500" />
                  <span>Export CSV Analysis</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Access Rules Warning for Candidate */}
        {user?.role === 'CANDIDATE' && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
              isEligible
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              {isEligible ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span className="font-bold">
                {isEligible
                  ? 'You meet all access criteria for this position!'
                  : `Ineligible: Missing requirements [${failedRules.join(', ')}]. Update your profile to qualify.`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-4">
        <button
          onClick={() => setActiveTab('template')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'template'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Template Requirements ({position.attributes.length})
        </button>
        <button
          onClick={() => setActiveTab('cvs')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'cvs'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Submitted CVs ({position.cvs.length})
        </button>
        <button
          onClick={() => setActiveTab('discussions')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
            activeTab === 'discussions'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Discussions ({position.discussions.length})</span>
        </button>
      </div>

      {/* Tab 1: Template Requirements */}
      {activeTab === 'template' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <span>Attributes Required in CV</span>
            </h3>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 divide-y divide-slate-100 dark:divide-slate-800">
              {position.attributes.map((pa, idx) => (
                <div key={pa.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {idx + 1}. {pa.attribute.name}
                    </div>
                    <div className="text-xs text-slate-500">{pa.attribute.category.name}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {pa.attribute.dataType}
                    </span>
                    {pa.isRequired && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        Required
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">Project Filter Rules</h3>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-500">Matching Tags:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {projectTags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold rounded-lg">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Max Included Projects:</span>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{position.maxProjects} projects</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Submitted CVs Table */}
      {activeTab === 'cvs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="p-4">Candidate Name</th>
                <th className="p-4">Location</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Recruiter Likes</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {position.cvs.map((cv) => (
                <tr key={cv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{cv.candidate.name}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 text-xs">{cv.candidate.location}</td>
                  <td className="p-4 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        cv.isPublished
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {cv.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center space-x-1 font-bold text-rose-500">
                      <Heart className="w-3.5 h-3.5 fill-rose-500" />
                      <span>{cv._count.likes}</span>
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => navigate(`/cvs/${cv.id}`)}
                      className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
                    >
                      View Rendered CV
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Position Discussions (Live Auto-Polling) */}
      {activeTab === 'discussions' && (
        <div className="space-y-4 max-w-3xl">
          {/* Discussion feed */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 max-h-[500px] overflow-y-auto">
            {position.discussions.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-8">No posts yet. Start the conversation!</div>
            ) : (
              position.discussions.map((post) => (
                <div key={post.id} className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {post.author.name.charAt(0)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {user?.role === 'RECRUITER' || user?.role === 'ADMIN' ? (
                          <button
                            onClick={() => navigate(`/profile/${post.author.id}`)}
                            className="font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {post.author.name}
                          </button>
                        ) : (
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{post.author.name}</span>
                        )}
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {post.author.role}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(post.createdAt).toLocaleTimeString()}</span>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 prose dark:prose-invert max-w-none">
                      <ReactMarkdown>{post.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* New post input */}
          {user && (
            <form onSubmit={handlePostDiscussion} className="flex items-center space-x-2">
              <input
                type="text"
                value={discussionInput}
                onChange={(e) => setDiscussionInput(e.target.value)}
                placeholder="Write a message (Markdown supported)..."
                className="flex-1 px-4 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={isPosting}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 flex items-center space-x-1"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* Odoo / Integrations Modal */}
      <IntegrationsModal
        isOpen={showIntegrationsModal}
        onClose={() => setShowIntegrationsModal(false)}
        positionTitle={position.title}
        apiToken={position.apiToken}
      />
    </div>
  );
};

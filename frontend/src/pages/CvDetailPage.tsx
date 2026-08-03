import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useThemeLanguage } from '../context/ThemeLanguageContext';
import { OptimisticLockingBanner } from '../components/OptimisticLockingBanner';
import { CloudImageUploader } from '../components/CloudImageUploader';
import {
  FileText,
  Printer,
  Heart,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Layers,
  MapPin,
  Mail,
  User as UserIcon,
  Sparkles,
  ArrowLeft,
  Calendar,
} from 'lucide-react';

interface CompiledAttribute {
  positionAttrId: string;
  attributeId: string;
  name: string;
  description: string;
  dataType: string;
  category: string;
  options: string[] | null;
  isRequired: boolean;
  value: string;
  version: number;
  isEmpty: boolean;
}

interface CvData {
  cv: {
    id: string;
    isPublished: boolean;
    version: number;
    createdAt: string;
    likesCount: number;
    likedByRecruiterIds: string[];
  };
  candidate: { id: string; name: string; email: string; location: string; avatarUrl: string };
  position: { id: string; title: string; description: string; maxProjects: number };
  attributes: CompiledAttribute[];
  projects: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate?: string;
    description: string;
    tagsJson: string;
  }>;
  canPublish: boolean;
  missingCount: number;
}

export const CvDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useThemeLanguage();
  const navigate = useNavigate();

  const [data, setData] = useState<CvData | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  // Inline editing state for attribute values
  const [editingAttrValues, setEditingAttrValues] = useState<Record<string, string>>({});
  const [conflictError, setConflictError] = useState<string | null>(null);

  const fetchCv = async () => {
    if (!id) return;
    try {
      const res = await apiRequest<CvData>(`/cvs/${id}`);
      setData(res);

      const valMap: Record<string, string> = {};
      res.attributes.forEach((a) => {
        valMap[a.attributeId] = a.value;
      });
      setEditingAttrValues(valMap);
      setConflictError(null);

      // Generate QR Code linking back to this CV page
      const pageUrl = window.location.href;
      const qrUrl = await QRCode.toDataURL(pageUrl, { width: 120, margin: 1 });
      setQrCodeDataUrl(qrUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCv();
  }, [id]);

  const isCandidateOwner = user?.id === data?.candidate.id;
  const isRecruiterOrAdmin = user?.role === 'RECRUITER' || user?.role === 'ADMIN';

  const handleInlineAttrChange = async (attributeId: string, value: string, version: number) => {
    if (!id) return;
    setEditingAttrValues((prev) => ({ ...prev, [attributeId]: value }));

    try {
      await apiRequest(`/cvs/${id}/attributes`, {
        method: 'PUT',
        body: JSON.stringify({ attributeId, value, version }),
      });
      fetchCv();
    } catch (err: any) {
      if (err.currentVersion !== undefined) {
        setConflictError(err.error || 'Optimistic locking conflict on CV inline update.');
      } else {
        alert(err.error || 'Failed to update attribute value');
      }
    }
  };

  const handlePublishCv = async () => {
    if (!id) return;
    try {
      await apiRequest(`/cvs/${id}/publish`, { method: 'POST' });
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      fetchCv();
    } catch (err: any) {
      alert(err.error || 'Cannot publish CV');
    }
  };

  const handleToggleLike = async () => {
    if (!id) return;
    try {
      await apiRequest(`/cvs/${id}/like`, { method: 'POST' });
      fetchCv();
    } catch (err: any) {
      alert(err.error || 'Only Recruiters can like CVs');
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { cv, candidate, position, attributes, projects, canPublish, missingCount } = data;
  const isLikedByMe = user ? cv.likedByRecruiterIds.includes(user.id) : false;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Action Bar (No Print) */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Badge */}
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-extrabold ${
              cv.isPublished ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
            }`}
          >
            {cv.isPublished ? 'Published CV' : `Draft CV (${missingCount} required fields missing)`}
          </span>

          {/* Like Button for Recruiters */}
          {isRecruiterOrAdmin && (
            <button
              onClick={handleToggleLike}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all shadow ${
                isLikedByMe
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Heart className={`w-4 h-4 ${isLikedByMe ? 'fill-white' : 'text-rose-500'}`} />
              <span>{isLikedByMe ? 'Liked' : 'Like Candidate'} ({cv.likesCount})</span>
            </button>
          )}

          {/* Candidate Publish Button */}
          {isCandidateOwner && !cv.isPublished && (
            <button
              onClick={handlePublishCv}
              disabled={!canPublish}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold shadow-lg transition-all flex items-center space-x-1.5 ${
                canPublish
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Publish CV to Recruiters</span>
            </button>
          )}

          {/* Printable PDF Export Button */}
          <button
            onClick={handlePrintPdf}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 flex items-center space-x-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Printable PDF with QR</span>
          </button>
        </div>
      </div>

      {conflictError && (
        <OptimisticLockingBanner message={conflictError} onReload={fetchCv} onDismiss={() => setConflictError(null)} />
      )}

      {/* RENDERED PROFESSIONAL CV DOCUMENT */}
      <div className="bg-white text-slate-900 border border-slate-300 rounded-3xl p-8 md:p-12 shadow-2xl space-y-8 max-w-4xl mx-auto print:shadow-none print:border-none print:p-0">
        {/* CV Document Header */}
        <div className="flex flex-wrap items-start justify-between border-b border-slate-200 pb-6 gap-6">
          <div className="flex items-center space-x-5">
            <img
              src={candidate.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'}
              alt={candidate.name}
              className="w-24 h-24 rounded-2xl object-cover border-2 border-slate-200 shadow"
            />
            <div className="space-y-1">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{candidate.name}</h1>
              <h2 className="text-base font-bold text-blue-600">{position.title}</h2>
              <div className="text-xs text-slate-500 flex items-center space-x-3 pt-1">
                <span className="flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{candidate.email}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{candidate.location}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Generated QR Code (Section 12 requirement) */}
          {qrCodeDataUrl && (
            <div className="flex flex-col items-center space-y-1">
              <img src={qrCodeDataUrl} alt="CV Verification QR Code" className="w-24 h-24 border rounded-xl p-1 bg-white" />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Scan to Verify</span>
            </div>
          )}
        </div>

        {/* Section 1: Required Position Attributes */}
        <div className="space-y-4">
          <h3 className="font-extrabold text-base text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Position Required Qualifications</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {attributes.map((attr) => {
              const val = editingAttrValues[attr.attributeId] ?? attr.value;
              const isEmpty = !val || val.trim() === '';
              let options: string[] = attr.options || [];

              return (
                <div
                  key={attr.attributeId}
                  className={`p-4 rounded-2xl border transition-all ${
                    isEmpty
                      ? 'bg-red-50 border-red-300 text-red-900 ring-2 ring-red-400/30'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">{attr.name}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">{attr.category}</span>
                  </div>

                  {/* Inline Attribute Editing for Candidate / Read-Only with Red Highlight for Recruiter */}
                  {isCandidateOwner ? (
                    attr.dataType === 'ONE_OF_MANY' ? (
                      <select
                        value={val}
                        onChange={(e) => handleInlineAttrChange(attr.attributeId, e.target.value, attr.version)}
                        className={`w-full px-3 py-1.5 text-xs rounded-xl font-semibold border ${
                          isEmpty ? 'border-red-400 bg-white text-red-700 font-bold' : 'border-slate-300 bg-white'
                        }`}
                      >
                        <option value="">-- Missing Required Value (Click to set) --</option>
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
                          checked={val === 'true'}
                          onChange={(e) => handleInlineAttrChange(attr.attributeId, String(e.target.checked), attr.version)}
                          className="rounded border-slate-300 text-blue-600 w-4 h-4"
                        />
                        <span className="text-xs font-bold">Yes / Available</span>
                      </label>
                    ) : attr.dataType === 'IMAGE' ? (
                      <CloudImageUploader value={val} onChange={(url) => handleInlineAttrChange(attr.attributeId, url, attr.version)} />
                    ) : (
                      <input
                        type={attr.dataType === 'NUMERIC' ? 'number' : 'text'}
                        value={val}
                        onChange={(e) => setEditingAttrValues({ ...editingAttrValues, [attr.attributeId]: e.target.value })}
                        onBlur={(e) => handleInlineAttrChange(attr.attributeId, e.target.value, attr.version)}
                        placeholder="[MISSING REQUIRED FIELD - CLICK TO EDIT]"
                        className={`w-full px-3 py-1.5 text-xs rounded-xl border ${
                          isEmpty ? 'border-red-400 bg-white text-red-600 font-bold placeholder-red-400' : 'border-slate-300 bg-white'
                        }`}
                      />
                    )
                  ) : (
                    /* Read-Only View for Recruiters */
                    <div className="pt-1">
                      {isEmpty ? (
                        <span className="text-xs font-bold text-red-600 flex items-center space-x-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>[NOT FILLED BY CANDIDATE]</span>
                        </span>
                      ) : attr.dataType === 'IMAGE' ? (
                        <img src={val} alt={attr.name} className="w-24 h-24 object-cover rounded-xl border" />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-900">{val}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Filtered Projects */}
        <div className="space-y-4">
          <h3 className="font-extrabold text-base text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center space-x-2">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <span>Tailored Project Portfolio</span>
          </h3>

          {projects.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 italic">No matching candidate projects for this position's tags.</div>
          ) : (
            <div className="space-y-4">
              {projects.map((p) => {
                const tags: string[] = JSON.parse(p.tagsJson || '[]');
                return (
                  <div key={p.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-900">{p.name}</h4>
                      <span className="text-xs text-slate-500 font-semibold">
                        {p.startDate} — {p.endDate || 'Present'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 prose max-w-none">
                      <ReactMarkdown>{p.description}</ReactMarkdown>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

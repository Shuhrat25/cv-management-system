import React, { useRef } from 'react';
import { Award, Download, Star, ShieldCheck, Zap, Heart, CheckCircle2 } from 'lucide-react';

interface AchievementsPanelProps {
  userName: string;
  projectsCount: number;
  cvsCount: number;
  likesCount: number;
}

export const AchievementsPanel: React.FC<AchievementsPanelProps> = ({
  userName,
  projectsCount,
  cvsCount,
  likesCount,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const badges = [
    {
      title: 'Project Builder',
      desc: `${projectsCount} Projects Completed`,
      unlocked: projectsCount >= 1,
      level: projectsCount >= 3 ? 'Master' : 'Novice',
      color: '#3b82f6',
      icon: Zap,
    },
    {
      title: 'CV Specialist',
      desc: `${cvsCount} Position CVs Generated`,
      unlocked: cvsCount >= 1,
      level: cvsCount >= 2 ? 'Expert' : 'Pro',
      color: '#10b981',
      icon: ShieldCheck,
    },
    {
      title: 'Recruiter Favorite',
      desc: `${likesCount} Likes Received`,
      unlocked: likesCount >= 1,
      level: likesCount >= 5 ? 'Legend' : 'Rising Star',
      color: '#ec4899',
      icon: Heart,
    },
  ];

  const handleDownloadSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `${userName.replace(/\s+/g, '_')}_Achievements_Panel.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base tracking-tight">Candidate Achievements & Badges</h3>
            <p className="text-xs text-indigo-300">Verified System Performance Milestones</p>
          </div>
        </div>

        <button
          onClick={handleDownloadSvg}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/30 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download SVG Panel</span>
        </button>
      </div>

      {/* Embedded Rendered SVG for SVG Export */}
      <div className="w-full flex justify-center py-2 overflow-x-auto">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 600 200"
          className="w-full max-w-xl h-auto rounded-xl bg-slate-950/80 p-4 border border-indigo-500/20 shadow-inner"
        >
          <defs>
            <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          <rect width="600" height="200" rx="16" fill="#090d16" stroke="#312e81" strokeWidth="2" />

          <text x="30" y="35" fill="#f8fafc" fontSize="18" fontWeight="bold" fontFamily="sans-serif">
            {userName} — Official Badge Matrix
          </text>
          <text x="30" y="55" fill="#818cf8" fontSize="12" fontFamily="sans-serif">
            Generated on {new Date().toLocaleDateString()} via TalentPulse
          </text>

          {/* Badge 1 */}
          <g transform="translate(30, 80)">
            <rect width="160" height="95" rx="12" fill="#1e1b4b" stroke={projectsCount > 0 ? '#3b82f6' : '#334155'} strokeWidth="2" />
            <circle cx="35" cy="40" r="18" fill="#3b82f6" opacity="0.2" />
            <text x="35" y="45" fill="#3b82f6" fontSize="18" textAnchor="middle">⚡</text>
            <text x="65" y="38" fill="#ffffff" fontSize="13" fontWeight="bold">Project Builder</text>
            <text x="65" y="54" fill="#94a3b8" fontSize="11">{projectsCount} Projects</text>
            <text x="65" y="74" fill="#3b82f6" fontSize="10" fontWeight="bold">{projectsCount > 0 ? 'UNLOCKED' : 'LOCKED'}</text>
          </g>

          {/* Badge 2 */}
          <g transform="translate(220, 80)">
            <rect width="160" height="95" rx="12" fill="#064e3b" stroke={cvsCount > 0 ? '#10b981' : '#334155'} strokeWidth="2" />
            <circle cx="35" cy="40" r="18" fill="#10b981" opacity="0.2" />
            <text x="35" y="45" fill="#10b981" fontSize="18" textAnchor="middle">🛡️</text>
            <text x="65" y="38" fill="#ffffff" fontSize="13" fontWeight="bold">CV Specialist</text>
            <text x="65" y="54" fill="#94a3b8" fontSize="11">{cvsCount} CVs Created</text>
            <text x="65" y="74" fill="#10b981" fontSize="10" fontWeight="bold">{cvsCount > 0 ? 'UNLOCKED' : 'LOCKED'}</text>
          </g>

          {/* Badge 3 */}
          <g transform="translate(410, 80)">
            <rect width="160" height="95" rx="12" fill="#831843" stroke={likesCount > 0 ? '#ec4899' : '#334155'} strokeWidth="2" />
            <circle cx="35" cy="40" r="18" fill="#ec4899" opacity="0.2" />
            <text x="35" y="45" fill="#ec4899" fontSize="18" textAnchor="middle">❤️</text>
            <text x="65" y="38" fill="#ffffff" fontSize="13" fontWeight="bold">Recruiter Fav</text>
            <text x="65" y="54" fill="#94a3b8" fontSize="11">{likesCount} Likes</text>
            <text x="65" y="74" fill="#ec4899" fontSize="10" fontWeight="bold">{likesCount > 0 ? 'UNLOCKED' : 'LOCKED'}</text>
          </g>
        </svg>
      </div>
    </div>
  );
};

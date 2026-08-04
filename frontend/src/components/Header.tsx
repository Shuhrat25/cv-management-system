import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useThemeLanguage } from '../context/ThemeLanguageContext';
import { apiRequest } from '../services/api';
import {
  Search,
  Sun,
  Moon,
  Globe,
  UserCheck,
  Briefcase,
  Layers,
  User as UserIcon,
  Shield,
  LogOut,
  LogIn,
  UserPlus,
  Sparkles,
  ChevronDown,
  HelpCircle,
  Building2,
} from 'lucide-react';

interface SearchResults {
  positions: Array<{ id: string; title: string; description: string }>;
  attributes: Array<{ id: string; name: string; category: { name: string } }>;
  candidates: Array<{ id: string; name: string; email: string }>;
  cvs: Array<{ id: string; candidate: { name: string }; position: { title: string } }>;
}

export const Header: React.FC<{ onOpenIntegrations?: () => void }> = ({ onOpenIntegrations }) => {
  const { user, demoUsers, switchDemoUser, logout } = useAuth();
  const { theme, toggleTheme, language, setLanguage, t } = useThemeLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Demo user dropdown state
  const [showDemoDropdown, setShowDemoDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await apiRequest<SearchResults>(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(results);
        setShowSearchResults(true);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const navLinkClass = (path: string) =>
    `flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      location.pathname === path
        ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
              TalentPulse
            </span>
            <span className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 -mt-1 tracking-wider">
              CV Engine
            </span>
          </div>
        </Link>

        {/* Global Full-Text Search (Header Requirement) */}
        <div ref={searchRef} className="relative flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-all"
            />
          </div>

          {/* Search Dropdown Results */}
          {showSearchResults && searchResults && (
            <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto z-50 p-2 space-y-3">
              {/* Positions */}
              {searchResults.positions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-1">Positions</h4>
                  {searchResults.positions.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        navigate(`/positions/${p.id}`);
                        setShowSearchResults(false);
                      }}
                      className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer text-sm"
                    >
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{p.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{p.description}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Attributes */}
              {searchResults.attributes.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-1">Attributes</h4>
                  {searchResults.attributes.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => {
                        navigate('/attributes');
                        setShowSearchResults(false);
                      }}
                      className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer text-sm flex justify-between items-center"
                    >
                      <span className="font-medium text-slate-900 dark:text-slate-100">{a.name}</span>
                      <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                        {a.category.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* CVs */}
              {searchResults.cvs.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-1">CVs</h4>
                  {searchResults.cvs.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        navigate(`/cvs/${c.id}`);
                        setShowSearchResults(false);
                      }}
                      className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer text-sm font-medium text-slate-900 dark:text-slate-100"
                    >
                      {c.candidate.name} — {c.position.title}
                    </div>
                  ))}
                </div>
              )}

              {searchResults.positions.length === 0 &&
                searchResults.attributes.length === 0 &&
                searchResults.cvs.length === 0 && (
                  <div className="px-4 py-3 text-center text-sm text-slate-500">No matching results found</div>
                )}
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-1">
          <Link to="/" className={navLinkClass('/')}>
            <Briefcase className="w-4 h-4" />
            <span>{t('dashboard')}</span>
          </Link>
          <Link to="/positions" className={navLinkClass('/positions')}>
            <Building2 className="w-4 h-4" />
            <span>{t('positions')}</span>
          </Link>
          {(user?.role === 'RECRUITER' || user?.role === 'ADMIN') && (
            <Link to="/attributes" className={navLinkClass('/attributes')}>
              <Layers className="w-4 h-4" />
              <span>{t('attributeLibrary')}</span>
            </Link>
          )}
          {user && (
            <Link to="/profile" className={navLinkClass('/profile')}>
              <UserIcon className="w-4 h-4" />
              <span>{t('myProfile')}</span>
            </Link>
          )}
          {user?.role === 'ADMIN' && (
            <Link to="/users" className={navLinkClass('/users')}>
              <Shield className="w-4 h-4 text-purple-500" />
              <span>{t('userManagement')}</span>
            </Link>
          )}
        </nav>

        {/* Controls: Role Switcher, i18n, Theme, User */}
        <div className="flex items-center space-x-2.5">
          {/* Support / Integrations Button */}
          {onOpenIntegrations && (
            <button
              onClick={onOpenIntegrations}
              title="Integrations & Support"
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <HelpCircle className="w-5 h-5 text-blue-500" />
            </button>
          )}

          {/* Quick Demo Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDemoDropdown(!showDemoDropdown)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{user ? `${user.name} (${user.role})` : 'Select Demo Account'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showDemoDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-1">
                  Quick Switch Role
                </div>
                {demoUsers.map((du) => (
                  <button
                    key={du.id}
                    onClick={() => {
                      switchDemoUser(du.id);
                      setShowDemoDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                      user?.id === du.id
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{du.name}</div>
                      <div className="text-[10px] text-slate-400">{du.email}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        du.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                          : du.role === 'RECRUITER'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      }`}
                    >
                      {du.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'uz' : 'en')}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            <span>{language.toUpperCase()}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {user ? (
            <button
              onClick={logout}
              title="Logout"
              className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                to="/register"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

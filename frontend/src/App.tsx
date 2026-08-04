import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeLanguageProvider } from './context/ThemeLanguageContext';
import { Header } from './components/Header';
import { IntegrationsModal } from './components/IntegrationsModal';
import { DashboardPage } from './pages/DashboardPage';
import { AttributeLibraryPage } from './pages/AttributeLibraryPage';
import { PositionsPage } from './pages/PositionsPage';
import { PositionDetailPage } from './pages/PositionDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { CvDetailPage } from './pages/CvDetailPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

export const AppContent: React.FC = () => {
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      <Header onOpenIntegrations={() => setShowIntegrationsModal(true)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/attributes" element={<AttributeLibraryPage />} />
          <Route path="/positions" element={<PositionsPage />} />
          <Route path="/positions/:id" element={<PositionDetailPage />} />
          <Route path="/profile/:userId?" element={<ProfilePage />} />
          <Route path="/cvs/:id" element={<CvDetailPage />} />
          <Route path="/users" element={<UserManagementPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </main>

      <footer className="no-print border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>TalentPulse &copy; 2026 — Course Project Implementation</span>
          <button
            onClick={() => setShowIntegrationsModal(true)}
            className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
          >
            Support Ticket & Enterprise Integrations
          </button>
        </div>
      </footer>

      <IntegrationsModal isOpen={showIntegrationsModal} onClose={() => setShowIntegrationsModal(false)} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <ThemeLanguageProvider>
          <AppContent />
        </ThemeLanguageProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'uz';
type Theme = 'light' | 'dark';

interface ThemeLanguageContextType {
  theme: Theme;
  language: Language;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    dashboard: 'Dashboard',
    positions: 'Positions',
    attributeLibrary: 'Attribute Library',
    myProfile: 'My Profile',
    userManagement: 'User Management',
    searchPlaceholder: 'Search positions, attributes, candidates...',
    latestPositions: 'Latest Positions',
    popularPositions: 'Most Popular Positions',
    tagCloud: 'Skills & Tech Tags Cloud',
    statsCVs24h: 'CVs Created (24h)',
    statsTotalPositions: 'Total Positions',
    statsTotalCandidates: 'Candidates',
    statsTotalRecruiters: 'Recruiters',
    statsSubmittedCVs: 'Submitted CVs',
    createPosition: 'Create Position',
    createAttribute: 'Create Attribute',
    publishCv: 'Publish CV',
    published: 'Published',
    draft: 'Draft',
    optimisticConflictTitle: 'Optimistic Locking Version Conflict',
    optimisticConflictDesc: 'This item was updated by another user while you were editing.',
    reload: 'Reload Fresh Data',
    missingAttributes: 'Missing Attributes',
    accessRules: 'Candidate Access Rules',
    qualifies: 'Qualified',
    doesNotQualify: 'Action Required: Ineligible',
    likes: 'Likes',
    discussion: 'Discussions',
    salesforceSync: 'Salesforce CRM',
    powerAutomateTicket: 'Support Ticket (Power Automate)',
    odooApiToken: 'Odoo API Token',
  },
  uz: {
    dashboard: 'Bosh sahifa',
    positions: 'Vakansiyalar',
    attributeLibrary: 'Atributlar Kutubxonasi',
    myProfile: 'Mening Profilim',
    userManagement: 'Foydalanuvchilar',
    searchPlaceholder: 'Vakansiya, atribut va nomzodlarni qidirish...',
    latestPositions: 'Eng So‘nggi Vakansiyalar',
    popularPositions: 'Ommabop Vakansiyalar',
    tagCloud: 'Texnologiyalar va Ko‘nikmalar Buluti',
    statsCVs24h: '24 soatda yaratilgan rezyumelar',
    statsTotalPositions: 'Jami Vakansiyalar',
    statsTotalCandidates: 'Nomzodlar',
    statsTotalRecruiters: 'Rekruterlar',
    statsSubmittedCVs: 'Yuborilgan Rezyumelar',
    createPosition: 'Vakansiya Yaratish',
    createAttribute: 'Atribut Yaratish',
    publishCv: 'Rezyumeni Nashr Qilish',
    published: 'Chop Etilgan',
    draft: 'Qoralama',
    optimisticConflictTitle: 'Versiya Ziddiyati (Optimistic Locking)',
    optimisticConflictDesc: 'Siz tahrirlayotganingizda ushbu yozuv boshqa foydalanuvchi tomonidan yangilandi.',
    reload: 'Ma’lumotlarni Yangilash',
    missingAttributes: 'Yetishmayotgan Atributlar',
    accessRules: 'Nomzod uchun Talablar',
    qualifies: 'Mos Keladi',
    doesNotQualify: 'Mos Kelmaydi',
    likes: 'Layklar',
    discussion: 'Munozaralar',
    salesforceSync: 'Salesforce CRM Integratsiyasi',
    powerAutomateTicket: 'Qo‘llab-quvvatlash Chiptasi (Power Automate)',
    odooApiToken: 'Odoo API Tokeni',
  },
};

const ThemeLanguageContext = createContext<ThemeLanguageContextType | undefined>(undefined);

export const ThemeLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setLanguage = (lang: Language) => {
    localStorage.setItem('language', lang);
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <ThemeLanguageContext.Provider value={{ theme, language, toggleTheme, setLanguage, t }}>
      {children}
    </ThemeLanguageContext.Provider>
  );
};

export const useThemeLanguage = () => {
  const ctx = useContext(ThemeLanguageContext);
  if (!ctx) throw new Error('useThemeLanguage must be used within ThemeLanguageProvider');
  return ctx;
};

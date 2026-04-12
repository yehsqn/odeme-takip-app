import React, { createContext, useContext, useState, useCallback } from 'react';
import translations from '../i18n/translations';

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('language') || 'tr';
    });

    const toggleLanguage = useCallback(() => {
        setLanguage(prev => {
            const next = prev === 'tr' ? 'en' : 'tr';
            localStorage.setItem('language', next);
            return next;
        });
    }, []);

    const setLang = useCallback((lang) => {
        localStorage.setItem('language', lang);
        setLanguage(lang);
    }, []);

    // t(key) — returns translation string or calls function keys with args
    const t = useCallback((key, ...args) => {
        const val = translations[language]?.[key] ?? translations['tr']?.[key] ?? key;
        return typeof val === 'function' ? val(...args) : val;
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, toggleLanguage, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
    return ctx;
};

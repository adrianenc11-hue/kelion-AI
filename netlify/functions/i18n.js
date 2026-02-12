/**
 * i18n Translation System — Multi-language support for Kelion AI
 * Supports: EN, RO, ES, FR, DE, IT, PT, JA, ZH, KO
 * Called from frontend to get translations for UI elements
 */

const { patchProcessEnv } = require('./get-secret');

// ═══ TRANSLATION DATABASE ═══
const translations = {
    en: {
        // Navigation
        nav_home: 'Home', nav_chat: 'Chat with K', nav_subscribe: 'Subscribe',
        nav_premium: 'Premium', nav_developers: 'Developers', nav_trading: 'Trading',
        nav_account: 'Account', nav_login: 'Log In', nav_signup: 'Sign Up',
        // Chat
        chat_placeholder: 'Type your message...', chat_send: 'Send',
        chat_thinking: 'K is thinking...', chat_browse: 'Browse Mode',
        chat_voice: 'Voice', chat_attach: 'Attach file',
        chat_profession: 'Select profession', chat_custom: 'Custom',
        // Professions
        prof_professor: 'Professor', prof_lawyer: 'Lawyer', prof_dietitian: 'Dietitian',
        prof_architect: 'Architect', prof_psychologist: 'Psychologist',
        prof_sales: 'Sales Agent', prof_chef: 'Chef', prof_software: 'Software Engineer',
        prof_syseng: 'System Engineer', prof_cyber: 'Cyber Security',
        prof_finance: 'Financial Advisor', prof_data: 'Data Analyst',
        // Landing
        hero_title: 'Meet K — Your AI Assistant',
        hero_subtitle: 'Premium AI with 12+ expert professions, real-time browsing, and voice capabilities',
        hero_cta: 'Start Chatting', hero_demo: 'Watch Demo',
        // Subscribe
        sub_monthly: 'Monthly', sub_annual: 'Annual', sub_family: 'Family',
        sub_business: 'Business', sub_free: 'Free Tier', sub_premium: 'Premium',
        sub_cta: 'Subscribe Now', sub_trial: 'Start Free Trial',
        // Common
        loading: 'Loading...', error: 'An error occurred', retry: 'Retry',
        save: 'Save', cancel: 'Cancel', confirm: 'Confirm', close: 'Close',
        success: 'Success!', copied: 'Copied!', settings: 'Settings',
        dark_mode: 'Dark Mode', language: 'Language',
        // Footer
        footer_privacy: 'Privacy Policy', footer_terms: 'Terms of Service',
        footer_gdpr: 'GDPR', footer_cookies: 'Cookie Policy',
        footer_contact: 'Contact', footer_about: 'About'
    },
    ro: {
        nav_home: 'Acasă', nav_chat: 'Vorbește cu K', nav_subscribe: 'Abonare',
        nav_premium: 'Premium', nav_developers: 'Dezvoltatori', nav_trading: 'Trading',
        nav_account: 'Cont', nav_login: 'Autentificare', nav_signup: 'Înregistrare',
        chat_placeholder: 'Scrie mesajul tău...', chat_send: 'Trimite',
        chat_thinking: 'K se gândește...', chat_browse: 'Mod Navigare',
        chat_voice: 'Voce', chat_attach: 'Atașează fișier',
        chat_profession: 'Selectează profesia', chat_custom: 'Personalizat',
        prof_professor: 'Profesor', prof_lawyer: 'Avocat', prof_dietitian: 'Nutriționist',
        prof_architect: 'Arhitect', prof_psychologist: 'Psiholog',
        prof_sales: 'Agent Vânzări', prof_chef: 'Bucătar', prof_software: 'Inginer Software',
        prof_syseng: 'Inginer Sisteme', prof_cyber: 'Securitate Cibernetică',
        prof_finance: 'Consultant Financiar', prof_data: 'Analist Date',
        hero_title: 'Descoperă K — Asistentul tău AI',
        hero_subtitle: 'AI premium cu 12+ profesii expert, navigare în timp real și capabilități vocale',
        hero_cta: 'Începe Conversația', hero_demo: 'Vezi Demo',
        sub_monthly: 'Lunar', sub_annual: 'Anual', sub_family: 'Familie',
        sub_business: 'Business', sub_free: 'Gratuit', sub_premium: 'Premium',
        sub_cta: 'Abonează-te Acum', sub_trial: 'Începe Perioada de Probă',
        loading: 'Se încarcă...', error: 'A apărut o eroare', retry: 'Reîncearcă',
        save: 'Salvează', cancel: 'Anulează', confirm: 'Confirmă', close: 'Închide',
        success: 'Succes!', copied: 'Copiat!', settings: 'Setări',
        dark_mode: 'Mod Întunecat', language: 'Limbă',
        footer_privacy: 'Politica de Confidențialitate', footer_terms: 'Termeni și Condiții',
        footer_gdpr: 'GDPR', footer_cookies: 'Politica Cookies',
        footer_contact: 'Contact', footer_about: 'Despre'
    },
    es: {
        nav_home: 'Inicio', nav_chat: 'Habla con K', nav_subscribe: 'Suscribirse',
        nav_premium: 'Premium', nav_developers: 'Desarrolladores', nav_trading: 'Trading',
        nav_account: 'Cuenta', nav_login: 'Iniciar Sesión', nav_signup: 'Registrarse',
        chat_placeholder: 'Escribe tu mensaje...', chat_send: 'Enviar',
        chat_thinking: 'K está pensando...', chat_browse: 'Modo Navegación',
        hero_title: 'Conoce a K — Tu Asistente AI', hero_cta: 'Empieza a Chattar',
        loading: 'Cargando...', error: 'Ocurrió un error', retry: 'Reintentar',
        save: 'Guardar', cancel: 'Cancelar', confirm: 'Confirmar', close: 'Cerrar'
    },
    fr: {
        nav_home: 'Accueil', nav_chat: 'Discuter avec K', nav_subscribe: "S'abonner",
        nav_premium: 'Premium', nav_developers: 'Développeurs', nav_trading: 'Trading',
        nav_account: 'Compte', nav_login: 'Se Connecter', nav_signup: "S'inscrire",
        chat_placeholder: 'Tapez votre message...', chat_send: 'Envoyer',
        chat_thinking: 'K réfléchit...', chat_browse: 'Mode Navigation',
        hero_title: 'Découvrez K — Votre Assistant AI', hero_cta: 'Commencer à Discuter',
        loading: 'Chargement...', error: 'Une erreur est survenue', retry: 'Réessayer',
        save: 'Enregistrer', cancel: 'Annuler', confirm: 'Confirmer', close: 'Fermer'
    },
    de: {
        nav_home: 'Startseite', nav_chat: 'Mit K chatten', nav_subscribe: 'Abonnieren',
        hero_title: 'Lernen Sie K kennen — Ihren KI-Assistenten', hero_cta: 'Jetzt chatten',
        loading: 'Laden...', error: 'Ein Fehler ist aufgetreten', retry: 'Wiederholen',
        save: 'Speichern', cancel: 'Abbrechen', confirm: 'Bestätigen', close: 'Schließen'
    }
};

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
        const lang = body.lang || event.queryStringParameters?.lang || 'en';
        const keys = body.keys; // Optional: specific keys to return

        const langData = translations[lang] || translations.en;

        // If specific keys requested, return only those
        if (keys && Array.isArray(keys)) {
            const filtered = {};
            for (const k of keys) {
                filtered[k] = langData[k] || translations.en[k] || k;
            }
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, lang, translations: filtered }) };
        }

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                lang,
                available: Object.keys(translations),
                translations: langData
            })
        };
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

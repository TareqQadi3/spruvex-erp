import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import fullLogo from '@assets/IMG_9856_1782692974743.jpeg';
import { useLang } from '../context/LangContext';
import { getConfig } from '../config';
import { signupUrl } from '../lib/api';

const NAV_LINKS: { href: string; key: string }[] = [
  { href: '/erp', key: 'nav_erp' },
  { href: '/pos', key: 'nav_pos' },
  { href: '/restaurant', key: 'nav_restaurant' },
  { href: '/sales-repair', key: 'nav_sales_repair' },
  { href: '/features', key: 'nav_features' },
  { href: '/pricing', key: 'nav_pricing' },
  { href: '/faq', key: 'nav_faq' },
  { href: '/contact', key: 'nav_contact' },
];

export function getWhatsappUrl(config: ReturnType<typeof getConfig>, msg: string) {
  return `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(msg)}`;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { lang, setLang, t } = useLang();
  const config = getConfig();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showOffer, setShowOffer] = useState(false);

  useEffect(() => {
    if (!config.offer.enabled) return;
    const isClosed = localStorage.getItem('spruvex_offer_closed');
    if (isClosed) return;
    const timer = setTimeout(() => setShowOffer(true), 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCloseOffer = () => {
    setShowOffer(false);
    localStorage.setItem('spruvex_offer_closed', 'true');
  };

  return (
    <>
      <header className="navbar">
        <div className="container nav-inner">
          <Link href="/" className="nav-logo">
            <img src={fullLogo} alt="SpruVex Logo" />
            <span className="nav-wordmark">{t('brand')}</span>
          </Link>
          <nav className="nav-links">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>{t(l.key)}</Link>
            ))}
          </nav>
          <div className="nav-actions">
            <div className="toggle-pill">
              <button className={lang === 'ar' ? 'active' : ''} onClick={() => setLang('ar')}>AR</button>
              <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
            <a href={signupUrl()} className="btn btn-primary btn-sm">{t('nav_cta')}</a>
          </div>
          <button className="nav-burger" aria-label="Menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <span></span>
          </button>
        </div>
      </header>

      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setMobileMenuOpen(false)}>{t(l.key)}</Link>
        ))}
        <div className="mob-actions">
          <a href={signupUrl()} className="btn btn-gradient" onClick={() => setMobileMenuOpen(false)}>{t('nav_cta')}</a>
          <a href={getWhatsappUrl(config, 'مرحباً فريق SpruVex، أريد الاستفسار عن النظام.')} target="_blank" rel="noreferrer" className="btn btn-ghost">{t('nav_whatsapp')}</a>
        </div>
        <div className="mob-toggles">
          <div className="toggle-pill">
            <button className={lang === 'ar' ? 'active' : ''} onClick={() => { setLang('ar'); setMobileMenuOpen(false); }}>AR</button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => { setLang('en'); setMobileMenuOpen(false); }}>EN</button>
          </div>
        </div>
      </div>

      <main>{children}</main>

      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <img src={fullLogo} alt="SpruVex" />
              <p>{t('footer_desc')}</p>
            </div>
            <div className="footer-col">
              <h5>{t('footer_h1')}</h5>
              <ul>
                <li><Link href="/features">{t('nav_features')}</Link></li>
                <li><Link href="/pricing">{t('nav_pricing')}</Link></li>
                <li><Link href="/erp">{t('nav_erp')}</Link></li>
                <li><Link href="/pos">{t('nav_pos')}</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h5>{t('footer_h2')}</h5>
              <ul>
                <li><Link href="/faq">{t('footer_faq')}</Link></li>
                <li><a href="#">{t('footer_terms')}</a></li>
                <li><a href="#">{t('footer_privacy')}</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h5>{t('footer_h3')}</h5>
              <ul>
                <li><a href={getWhatsappUrl(config, 'مرحباً، لدي استفسار عن SpruVex.')} target="_blank" rel="noreferrer">WhatsApp Business</a></li>
                <li><a href="mailto:hello@spruvex.com">hello@spruvex.com</a></li>
                <li><span>{t('footer_hours')}</span></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>{t('footer_copy')}</span>
            <div className="footer-social">
              <a href="#" aria-label="X">𝕏</a>
              <a href="#" aria-label="Instagram">◎</a>
              <a href="#" aria-label="LinkedIn">in</a>
            </div>
          </div>
        </div>
      </footer>

      <a href={getWhatsappUrl(config, 'مرحباً، أريد الاستفسار عن نظام SpruVex.')} className="wa-float" aria-label="WhatsApp" target="_blank" rel="noreferrer">
        <span className="wa-ring"></span>
        💬
      </a>

      {showOffer && config.offer.enabled && (
        <div className="floating-offer">
          <button className="floating-offer-close" onClick={handleCloseOffer}>✕</button>
          <div className="floating-offer-title">{lang === 'ar' ? config.offer.titleAr : config.offer.titleEn}</div>
          <div className="floating-offer-desc">{lang === 'ar' ? config.offer.descAr : config.offer.descEn}</div>
          <div className="floating-offer-code" onClick={(e) => {
            navigator.clipboard.writeText(config.offer.code);
            const target = e.target as HTMLElement;
            target.innerText = t('offer_copied');
            setTimeout(() => { target.innerText = config.offer.code; }, 2000);
          }}>{config.offer.code}</div>
          <a href={signupUrl()} className="btn" onClick={handleCloseOffer}>{t('offer_cta')}</a>
        </div>
      )}
    </>
  );
}

import { useState } from 'react';
import { Link } from 'wouter';
import iconLogo from '@assets/IMG_9857_1782692974743.jpeg';
import { useLang } from '../context/LangContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { signupUrl } from '../lib/api';
import PricingGrid from '../components/PricingGrid';

const MODULE_CARDS = [
  { href: '/erp', icon: '🧾', titleKey: 'home_mod_erp_title', descKey: 'home_mod_erp_desc' },
  { href: '/pos', icon: '🛒', titleKey: 'home_mod_pos_title', descKey: 'home_mod_pos_desc' },
  { href: '/restaurant', icon: '🍽️', titleKey: 'home_mod_restaurant_title', descKey: 'home_mod_restaurant_desc' },
  { href: '/sales-repair', icon: '🛠️', titleKey: 'home_mod_repair_title', descKey: 'home_mod_repair_desc' },
];

export default function Home() {
  const { t } = useLang();
  useDocumentMeta(t('home_meta_title'), t('home_meta_desc'));
  const [openFaq, setOpenFaq] = useState<number | null>(1);

  return (
    <>
      {/* HERO */}
      <section className="hero" id="top">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><span className="dot"></span><span>{t('hero_eyebrow')}</span></span>
            <h1 dangerouslySetInnerHTML={{ __html: t('hero_title_html') }}></h1>
            <p>{t('hero_sub')}</p>
            <div className="hero-ctas">
              <a href={signupUrl()} className="btn btn-gradient">{t('hero_cta1')}</a>
              <Link href="/pricing" className="btn btn-ghost">{t('hero_cta2')}</Link>
            </div>
            <div className="hero-trust">
              <span className="stars">★★★★★</span>
              <span>{t('hero_trust1')}</span>
              <span className="trust-sep"></span>
              <span>{t('hero_trust2')}</span>
            </div>
          </div>

          <div className="system-map" aria-hidden="true">
            <svg className="map-svg" viewBox="0 0 500 480" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00D4FF" />
                  <stop offset="100%" stopColor="#6A2CFF" />
                </linearGradient>
              </defs>
              <path d="M250,240 L70,60" />
              <path d="M250,240 L420,40" />
              <path d="M250,240 L40,220" />
              <path d="M250,240 L460,230" />
              <path d="M250,240 L90,410" />
              <path d="M250,240 L420,420" />
            </svg>
            <div className="map-core">
              <div className="pulse"></div>
              <img src={iconLogo} alt="SpruVex" />
            </div>
            <div className="map-node n1"><span className="ico" style={{ background: '#EBF3FF', color: '#005BFF' }}>🧾</span><span className="lbl">{t('node_acc')}</span></div>
            <div className="map-node n2"><span className="ico" style={{ background: '#EAFBFF', color: '#00A6CC' }}>🛒</span><span className="lbl">{t('node_pos')}</span></div>
            <div className="map-node n3"><span className="ico" style={{ background: '#F1EBFF', color: '#6A2CFF' }}>📦</span><span className="lbl">{t('node_inv')}</span></div>
            <div className="map-node n4"><span className="ico" style={{ background: '#EBF3FF', color: '#005BFF' }}>🏬</span><span className="lbl">{t('node_branch')}</span></div>
            <div className="map-node n5"><span className="ico" style={{ background: '#E9FBEF', color: '#1FA855' }}>💬</span><span className="lbl">{t('node_wa')}</span></div>
            <div className="map-node n6"><span className="ico" style={{ background: '#FFF3E6', color: '#FF8A1F' }}>💳</span><span className="lbl">{t('node_pay')}</span></div>
          </div>
        </div>
      </section>

      {/* LOGO STRIP */}
      <section className="logo-strip">
        <div className="container">
          <p className="logo-strip-label">{t('strip_label')}</p>
          <div className="logo-row">
            <span className="logo-chip"><span className="dotc" style={{ background: '#6A2CFF' }}></span>سلة</span>
            <span className="logo-chip"><span className="dotc" style={{ background: '#00D4FF' }}></span>زد</span>
            <span className="logo-chip"><span className="dotc" style={{ background: '#95D600' }}></span>Shopify</span>
            <span className="logo-chip"><span className="dotc" style={{ background: '#1FD2AF' }}></span>Tabby</span>
            <span className="logo-chip"><span className="dotc" style={{ background: '#D63AFF' }}></span>Tamara</span>
            <span className="logo-chip"><span className="dotc" style={{ background: '#25D366' }}></span>WhatsApp Business</span>
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section className="section">
        <div className="container">
          <div className="section-head center animate-on-scroll">
            <span className="eyebrow"><span className="dot"></span><span>{t('home_modules_eyebrow')}</span></span>
            <h2 className="section-title">{t('home_modules_title')}</h2>
            <p className="section-sub">{t('home_modules_sub')}</p>
          </div>
          <div className="features-grid">
            {MODULE_CARDS.map((m) => (
              <Link key={m.href} href={m.href} className="feature-card animate-on-scroll" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="feature-icon">{m.icon}</div>
                <h3 className="feature-title">{t(m.titleKey)}</h3>
                <p className="feature-desc">{t(m.descKey)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES TEASER */}
      <section className="section" id="features">
        <div className="container">
          <div className="section-head center animate-on-scroll">
            <span className="eyebrow"><span className="dot"></span><span>{t('feat_eyebrow')}</span></span>
            <h2 className="section-title">{t('feat_title')}</h2>
            <p className="section-sub">{t('feat_sub')}</p>
          </div>
          <div className="features-grid">
            <div className="feature-card lead animate-on-scroll">
              <div className="feature-icon">🧩</div>
              <h3 className="feature-title">{t('feat1_title')}</h3>
              <p className="feature-desc">{t('feat1_desc')}</p>
            </div>
            <div className="feature-card animate-on-scroll delay-100">
              <div className="feature-icon">🏬</div>
              <h3 className="feature-title">{t('feat2_title')}</h3>
              <p className="feature-desc">{t('feat2_desc')}</p>
            </div>
            <div className="feature-card animate-on-scroll delay-200">
              <div className="feature-icon">📊</div>
              <h3 className="feature-title">{t('feat3_title')}</h3>
              <p className="feature-desc">{t('feat3_desc')}</p>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link href="/features" className="btn btn-ghost">{t('common_learn_more')}</Link>
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="section" id="pricing">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow"><span className="dot"></span><span>{t('home_pricing_eyebrow')}</span></span>
            <h2 className="section-title">{t('home_pricing_title')}</h2>
            <p className="section-sub">{t('home_pricing_sub')}</p>
          </div>
          <PricingGrid limit={3} />
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link href="/pricing" className="btn btn-ghost">{t('common_cta_pricing')}</Link>
          </div>
        </div>
      </section>

      {/* FAQ TEASER */}
      <section className="section" id="faq">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow"><span className="dot"></span><span>{t('home_faq_eyebrow')}</span></span>
            <h2 className="section-title">{t('home_faq_title')}</h2>
          </div>
          <div className="faq-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{t(`faq${i}_q`)}</span>
                  <span className="faq-plus">+</span>
                </div>
                <div className="faq-a">
                  <div className="faq-a-inner">{t(`faq${i}_a`)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link href="/faq" className="btn btn-ghost">{t('common_learn_more')}</Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="section" id="signup">
        <div className="container">
          <div className="trial-section">
            <div className="trial-copy">
              <h2>{t('final_cta_title')}</h2>
              <p>{t('final_cta_sub')}</p>
            </div>
            <div className="trial-card">
              <a href={signupUrl()} className="btn btn-gradient" style={{ width: '100%' }}>{t('final_cta_btn')}</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

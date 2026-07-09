import { useLang } from '../context/LangContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { signupUrl } from '../lib/api';

export interface ModuleFeature {
  icon: string;
  hKey: string;
  pKey: string;
}

export default function ModuleTemplate({
  eyebrowKey, titleKey, subKey,
  features, ctaTitleKey, ctaSubKey, ctaBtnKey,
  metaTitleKey, metaDescKey, plan,
}: {
  eyebrowKey: string; titleKey: string; subKey: string;
  features: ModuleFeature[];
  ctaTitleKey: string; ctaSubKey: string; ctaBtnKey: string;
  metaTitleKey: string; metaDescKey: string;
  plan?: string;
}) {
  const { t } = useLang();
  useDocumentMeta(t(metaTitleKey), t(metaDescKey));

  return (
    <>
      <section className="section">
        <div className="container">
          <div className="section-head center animate-on-scroll">
            <span className="eyebrow"><span className="dot"></span><span>{t(eyebrowKey)}</span></span>
            <h1 className="section-title">{t(titleKey)}</h1>
            <p className="section-sub">{t(subKey)}</p>
            <div className="hero-ctas" style={{ justifyContent: 'center', marginTop: 24 }}>
              <a href={signupUrl(plan)} className="btn btn-gradient">{t('common_cta_start')}</a>
              <a href="/pricing" className="btn btn-ghost">{t('common_cta_pricing')}</a>
            </div>
          </div>

          <div className="features-grid">
            {features.map((f, i) => (
              <div key={i} className={`feature-card animate-on-scroll delay-${(i % 3) * 100}`}>
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{t(f.hKey)}</h3>
                <p className="feature-desc">{t(f.pKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="module-cta">
        <div className="container">
          <div className="trial-section">
            <div className="trial-copy">
              <h2>{t(ctaTitleKey)}</h2>
              <p>{t(ctaSubKey)}</p>
            </div>
            <div className="trial-card">
              <a href={signupUrl(plan)} className="btn btn-gradient" style={{ width: '100%' }}>{t(ctaBtnKey)}</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

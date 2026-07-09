import { useEffect, useState } from 'react';
import { useLang } from '../context/LangContext';
import { fetchPlanCatalog, signupUrl, type PlanCatalog } from '../lib/api';
import { MODULE_LABEL_KEYS, ADDON_LABEL_KEYS } from '../lib/pricingLabels';

export default function PricingGrid({ showAddons = false, limit }: { showAddons?: boolean; limit?: number }) {
  const { lang, t } = useLang();
  const [state, setState] = useState<{ status: 'loading' | 'error' | 'ready'; data?: PlanCatalog }>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchPlanCatalog()
      .then((data) => { if (!cancelled) setState({ status: 'ready', data }); })
      .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, []);

  if (state.status === 'loading') {
    return <div className="section-head center"><p className="section-sub">{t('price_loading')}</p></div>;
  }

  if (state.status === 'error' || !state.data) {
    return (
      <div className="section-head center">
        <p className="section-sub">{t('price_error')}</p>
        <button className="btn btn-ghost" onClick={() => window.location.reload()}>{t('price_retry')}</button>
      </div>
    );
  }

  const plans = limit ? state.data.plans.slice(0, limit) : state.data.plans;

  return (
    <>
      <div className="pricing-grid">
        {plans.map((plan, i) => (
          <div key={plan.code} className={`plan-card ${i === 1 ? 'featured' : ''}`}>
            <div className="plan-name">{lang === 'ar' ? plan.nameAr : plan.nameEn}</div>
            <p className="plan-desc">{lang === 'ar' ? plan.taglineAr : plan.taglineEn}</p>
            <div className="plan-price">
              {plan.priceMonthlySar === null ? (
                <span className="amount">{t('price_contact_us')}</span>
              ) : (
                <>
                  <span className="amount">{plan.priceMonthlySar}</span>
                  <span className="curr">{t('price_per_month')}</span>
                </>
              )}
            </div>
            <ul className="plan-feat">
              <li><span className="chk">✓</span><span>{t('price_limit_users').replace('{n}', String(plan.maxUsers))}</span></li>
              <li><span className="chk">✓</span><span>{t('price_limit_branches').replace('{n}', String(plan.maxBranches))}</span></li>
              <li><span className="chk">✓</span><span>{t('price_limit_products').replace('{n}', String(plan.maxProducts))}</span></li>
              {plan.modules.map((m) => (
                <li key={m}><span className="chk">✓</span><span>{t(MODULE_LABEL_KEYS[m] || m)}</span></li>
              ))}
            </ul>
            <a href={signupUrl(plan.code)} className={i === 1 ? 'btn btn-gradient' : 'btn btn-ghost'}>{t('plan_cta')}</a>
          </div>
        ))}
      </div>

      {showAddons && state.data.addons.length > 0 && (
        <div style={{ marginTop: 56 }}>
          <div className="section-head center">
            <h3 className="section-title" style={{ fontSize: 26 }}>{t('price_addons_title')}</h3>
            <p className="section-sub">{t('price_addons_sub')}</p>
          </div>
          <div className="features-grid">
            {state.data.addons.map((addon) => (
              <div key={addon.code} className="feature-card">
                <div className="feature-icon">➕</div>
                <h3 className="feature-title">{t(ADDON_LABEL_KEYS[addon.code] || addon.code)}</h3>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

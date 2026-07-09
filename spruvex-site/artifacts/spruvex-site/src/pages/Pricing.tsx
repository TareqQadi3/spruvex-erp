import { useLang } from '../context/LangContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import PricingGrid from '../components/PricingGrid';

export default function Pricing() {
  const { t } = useLang();
  useDocumentMeta(t('pricing_meta_title'), t('pricing_meta_desc'));

  return (
    <section className="section" id="pricing">
      <div className="container">
        <div className="section-head center">
          <span className="eyebrow"><span className="dot"></span><span>{t('price_eyebrow')}</span></span>
          <h1 className="section-title">{t('price_title')}</h1>
          <p className="section-sub">{t('price_sub')}</p>
        </div>

        <PricingGrid showAddons />
      </div>
    </section>
  );
}

import { useState } from 'react';
import { useLang } from '../context/LangContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const FAQ_COUNT = 8;

export default function Faq() {
  const { t } = useLang();
  useDocumentMeta(t('faq_meta_title'), t('faq_meta_desc'));
  const [openFaq, setOpenFaq] = useState<number | null>(1);

  return (
    <section className="section">
      <div className="container">
        <div className="section-head center">
          <span className="eyebrow"><span className="dot"></span><span>{t('faq_eyebrow')}</span></span>
          <h1 className="section-title">{t('faq_title')}</h1>
        </div>
        <div className="faq-list">
          {Array.from({ length: FAQ_COUNT }, (_, i) => i + 1).map((i) => (
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
      </div>
    </section>
  );
}

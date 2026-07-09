import React, { useState } from 'react';
import { useLang } from '../context/LangContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { getConfig, saveLead } from '../config';
import { getWhatsappUrl } from '../components/Layout';

export default function Contact() {
  const { t } = useLang();
  useDocumentMeta(t('contact_meta_title'), t('contact_meta_desc'));
  const config = getConfig();
  const [activeFormTab, setActiveFormTab] = useState('trial');
  const [showSuccess, setShowSuccess] = useState(false);

  const waUrl = (msg: string) => getWhatsappUrl(config, msg);

  const handleTrialFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name     = String(fd.get('name')     || '');
    const store    = String(fd.get('store')    || '');
    const phone    = String(fd.get('phone')    || '');
    const email    = String(fd.get('email')    || '');
    const interest = String(fd.get('interest') || '');
    const channels = String(fd.get('channels') || '');
    const notes    = String(fd.get('notes')    || '');

    saveLead({ type: 'trial', name, store, phone, email, interest, channels, notes });

    const msg = `طلب جديد من SpruVex\nالاسم: ${name}\nالمتجر: ${store}\nالجوال: ${phone}\nالبريد: ${email}\nالاهتمام: ${interest}\nالقنوات: ${channels}\nملاحظات: ${notes}`;
    window.open(waUrl(msg), '_blank');
    setShowSuccess(true);
  };

  const handleContactFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name    = String(fd.get('name')    || '');
    const phone   = String(fd.get('phone')   || '');
    const email   = String(fd.get('email')   || '');
    const message = String(fd.get('message') || '');

    saveLead({ type: 'contact', name, phone, email, message });

    const msg = `استفسار جديد من SpruVex\nالاسم: ${name}\nالجوال: ${phone}\nالبريد: ${email}\nالرسالة: ${message}`;
    window.open(waUrl(msg), '_blank');
    setShowSuccess(true);
  };

  return (
    <section className="section" id="signup">
      <div className="container">
        <div className="signup-grid">
          <div className="signup-info">
            <span className="eyebrow"><span className="dot"></span><span>{t('signup_eyebrow')}</span></span>
            <h1>{t('signup_title')}</h1>
            <p>{t('signup_sub')}</p>

            <div className="info-row">
              <span className="ir-ico">⏱️</span>
              <div><h4>{t('info1_h')}</h4><p>{t('info1_p')}</p></div>
            </div>
            <div className="info-row">
              <span className="ir-ico">🔒</span>
              <div><h4>{t('info2_h')}</h4><p>{t('info2_p')}</p></div>
            </div>
            <div className="info-row">
              <span className="ir-ico">🛠️</span>
              <div><h4>{t('info3_h')}</h4><p>{t('info3_p')}</p></div>
            </div>

            <div className="wa-float-card">
              <span className="wic">💬</span>
              <div className="wt">
                <strong>{t('wa_card_h')}</strong>
                <span>{t('wa_card_p')}</span>
              </div>
              <a href={waUrl('مرحباً فريق SpruVex، أريد الاستفسار عن النظام.')} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ marginInlineStart: 'auto' }}>
                {t('wa_card_cta')}
              </a>
            </div>
          </div>

          <div className="signup-form">
            <div className="form-tabs">
              <button className={`form-tab ${activeFormTab === 'trial' ? 'active' : ''}`} onClick={() => setActiveFormTab('trial')}>{t('ftab1')}</button>
              <button className={`form-tab ${activeFormTab === 'contact' ? 'active' : ''}`} onClick={() => setActiveFormTab('contact')}>{t('ftab2')}</button>
            </div>

            {showSuccess ? (
              <div className="form-success show">
                <div className="fs-ico">✓</div>
                <h3>{t('success_h')}</h3>
                <p>{t('success_p')}</p>
              </div>
            ) : (
              <>
                <form className={`form-panel ${activeFormTab === 'trial' ? 'active' : ''}`} onSubmit={handleTrialFormSubmit}>
                  <div className="form-grid">
                    <div className="form-field">
                      <label>{t('f_name')}</label>
                      <input type="text" name="name" required />
                    </div>
                    <div className="form-field">
                      <label>{t('f_store')}</label>
                      <input type="text" name="store" required />
                    </div>
                    <div className="form-field">
                      <label>{t('f_phone')}</label>
                      <input type="tel" name="phone" required placeholder="05xxxxxxxx" />
                    </div>
                    <div className="form-field">
                      <label>{t('f_email')}</label>
                      <input type="email" name="email" required />
                    </div>
                    <div className="form-field">
                      <label>{t('f_interest')}</label>
                      <select name="interest">
                        <option value="trial">{t('f_int_trial')}</option>
                        <option value="basic">{t('f_int_basic')}</option>
                        <option value="pro">{t('f_int_pro')}</option>
                        <option value="enterprise">{t('f_int_ent')}</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>{t('f_channels')}</label>
                      <select name="channels">
                        <option value="">{t('f_ch_none')}</option>
                        <option value="salla">سلة</option>
                        <option value="zid">زد</option>
                        <option value="shopify">Shopify</option>
                        <option value="tabby_tamara">Tabby / Tamara</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>
                    </div>
                    <div className="form-field full">
                      <label>{t('f_notes')}</label>
                      <textarea name="notes"></textarea>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-gradient">{t('f_submit')}</button>
                    <a href={waUrl('مرحباً، أود طلب تجربة/اشتراك في نظام SpruVex.')} target="_blank" rel="noreferrer" className="btn btn-ghost">{t('f_wa_alt')}</a>
                  </div>
                  <p className="form-note">{t('f_note')}</p>
                </form>

                <form className={`form-panel ${activeFormTab === 'contact' ? 'active' : ''}`} onSubmit={handleContactFormSubmit}>
                  <div className="form-grid">
                    <div className="form-field">
                      <label>{t('f_name')}</label>
                      <input type="text" name="name" required />
                    </div>
                    <div className="form-field">
                      <label>{t('f_phone')}</label>
                      <input type="tel" name="phone" required placeholder="05xxxxxxxx" />
                    </div>
                    <div className="form-field full">
                      <label>{t('f_email')}</label>
                      <input type="email" name="email" required />
                    </div>
                    <div className="form-field full">
                      <label>{t('f_msg')}</label>
                      <textarea name="message" required></textarea>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-gradient">{t('f_submit')}</button>
                    <a href={waUrl('مرحباً فريق SpruVex، لدي استفسار.')} target="_blank" rel="noreferrer" className="btn btn-ghost">{t('f_wa_alt')}</a>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

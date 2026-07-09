import { useState } from 'react';
import { useLang } from '../context/LangContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function Features() {
  const { t } = useLang();
  useDocumentMeta(t('features_meta_title'), t('features_meta_desc'));
  const [activeIntTab, setActiveIntTab] = useState('stores');

  return (
    <>
      <section className="section">
        <div className="container">
          <div className="section-head center animate-on-scroll">
            <span className="eyebrow"><span className="dot"></span><span>{t('features_page_eyebrow')}</span></span>
            <h1 className="section-title">{t('features_page_title')}</h1>
            <p className="section-sub">{t('features_page_sub')}</p>
          </div>

          <div className="features-grid">
            <div className="feature-card lead animate-on-scroll">
              <div className="feature-icon">🧩</div>
              <h3 className="feature-title">{t('feat1_title')}</h3>
              <p className="feature-desc">{t('feat1_desc')}</p>
              <div className="lead-visual">
                <div className="lv-item" style={{ color: 'white' }}>{t('node_acc')}</div>
                <div className="lv-item" style={{ color: 'white' }}>{t('node_pos')}</div>
                <div className="lv-item" style={{ color: 'white' }}>{t('node_inv')}</div>
                <div className="lv-item" style={{ color: 'white' }}>{t('feat1_service')}</div>
              </div>
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
            <div className="feature-card animate-on-scroll delay-300">
              <div className="feature-icon">☁️</div>
              <h3 className="feature-title">{t('feat4_title')}</h3>
              <p className="feature-desc">{t('feat4_desc')}</p>
            </div>
            <div className="feature-card animate-on-scroll delay-100">
              <div className="feature-icon">🔌</div>
              <h3 className="feature-title">{t('feat5_title')}</h3>
              <p className="feature-desc">{t('feat5_desc')}</p>
            </div>
            <div className="feature-card animate-on-scroll delay-200">
              <div className="feature-icon">🧾</div>
              <h3 className="feature-title">{t('feat6_title')}</h3>
              <p className="feature-desc">{t('feat6_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="integrations">
        <div className="container">
          <div className="integrations-section">
            <div className="container">
              <div className="section-head">
                <span className="eyebrow"><span className="dot"></span><span>{t('int_eyebrow')}</span></span>
                <h2 className="section-title">{t('int_title')}</h2>
                <p className="section-sub">{t('int_sub')}</p>
              </div>

              <div className="int-tabs">
                <button className={`int-tab ${activeIntTab === 'stores' ? 'active' : ''}`} onClick={() => setActiveIntTab('stores')}>{t('int_tab1')}</button>
                <button className={`int-tab ${activeIntTab === 'bnpl' ? 'active' : ''}`} onClick={() => setActiveIntTab('bnpl')}>{t('int_tab2')}</button>
                <button className={`int-tab ${activeIntTab === 'wa' ? 'active' : ''}`} onClick={() => setActiveIntTab('wa')}>{t('int_tab3')}</button>
              </div>

              <div className="int-panels">
                <div className={`int-panel ${activeIntTab === 'stores' ? 'active' : ''}`}>
                  <div className="int-panel-copy">
                    <h3>{t('int1_h')}</h3>
                    <p>{t('int1_p')}</p>
                    <ul>
                      <li><span className="chk">✓</span><span>{t('int1_li1')}</span></li>
                      <li><span className="chk">✓</span><span>{t('int1_li2')}</span></li>
                      <li><span className="chk">✓</span><span>{t('int1_li3')}</span></li>
                    </ul>
                  </div>
                  <div className="int-visual">
                    <div className="int-flow">
                      <div className="flow-card"><span className="fc-ico" style={{ background: 'rgba(106,44,255,.18)', color: '#B89BFF' }}>🛍️</span><span>{t('flow_store')}</span></div>
                      <span className="flow-arrow">↓</span>
                      <div className="flow-card"><span className="fc-ico" style={{ background: 'rgba(0,212,255,.16)', color: '#5FE3FF' }}>🔗</span><span>{t('flow_sync')}</span></div>
                      <span className="flow-arrow">↓</span>
                      <div className="flow-card"><span className="fc-ico" style={{ background: 'rgba(0,91,255,.18)', color: '#7FB1FF' }}>🧾</span><span>{t('flow_acc')}</span></div>
                    </div>
                  </div>
                </div>

                <div className={`int-panel ${activeIntTab === 'bnpl' ? 'active' : ''}`}>
                  <div className="int-panel-copy">
                    <h3>{t('int2_h')}</h3>
                    <p>{t('int2_p')}</p>
                    <ul>
                      <li><span className="chk">✓</span><span>{t('int2_li1')}</span></li>
                      <li><span className="chk">✓</span><span>{t('int2_li2')}</span></li>
                      <li><span className="chk">✓</span><span>{t('int2_li3')}</span></li>
                    </ul>
                  </div>
                  <div className="int-visual">
                    <div className="int-flow">
                      <div className="flow-card"><span className="fc-ico" style={{ background: 'rgba(255,138,31,.18)', color: '#FFB066' }}>💳</span><span>{t('flow_bnpl1')}</span></div>
                      <span className="flow-arrow">↓</span>
                      <div className="flow-card"><span className="fc-ico" style={{ background: 'rgba(0,212,255,.16)', color: '#5FE3FF' }}>⚙️</span><span>{t('flow_bnpl2')}</span></div>
                      <span className="flow-arrow">↓</span>
                      <div className="flow-card"><span className="fc-ico" style={{ background: 'rgba(0,91,255,.18)', color: '#7FB1FF' }}>📋</span><span>{t('flow_bnpl3')}</span></div>
                    </div>
                  </div>
                </div>

                <div className={`int-panel ${activeIntTab === 'wa' ? 'active' : ''}`}>
                  <div className="int-panel-copy">
                    <h3>{t('int3_h')}</h3>
                    <p>{t('int3_p')}</p>
                    <ul>
                      <li><span className="chk">✓</span><span>{t('int3_li1')}</span></li>
                      <li><span className="chk">✓</span><span>{t('int3_li2')}</span></li>
                      <li><span className="chk">✓</span><span>{t('int3_li3')}</span></li>
                    </ul>
                  </div>
                  <div className="int-visual">
                    <div className="int-flow">
                      <div className="flow-card"><span className="fc-ico" style={{ background: 'rgba(37,211,102,.18)', color: '#5FE38C' }}>🧾</span><span>{t('flow_wa1')}</span></div>
                      <span className="flow-arrow">↓</span>
                      <div className="flow-card"><span className="fc-ico" style={{ background: 'rgba(37,211,102,.18)', color: '#5FE38C' }}>💬</span><span>{t('flow_wa2')}</span></div>
                      <span className="flow-arrow">↓</span>
                      <div className="flow-card"><span className="fc-ico" style={{ background: 'rgba(0,91,255,.18)', color: '#7FB1FF' }}>✅</span><span>{t('flow_wa3')}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  getConfig, saveConfig, getLeads, updateLeadStatus, deleteLead,
  isAdminAuthenticated, setAdminAuthenticated,
  ADMIN_PASSWORD, DEFAULT_CONFIG,
  type SiteConfig, type Lead, type PricingRow,
} from './config';

/* ─── tiny style helpers ─── */
const s = {
  wrap: { minHeight: '100vh', background: '#F0F2F8', fontFamily: "'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif", direction: 'rtl' as const },
  nav:  { background: '#0A1023', color: '#fff', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 },
  navBrand: { fontWeight: 700, fontSize: 17, letterSpacing: '-.01em' },
  navRight: { display: 'flex', alignItems: 'center', gap: 16 },
  body: { maxWidth: 1100, margin: '0 auto', padding: '28px 20px' },
  tabs: { display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap' as const },
  tab: (active: boolean): React.CSSProperties => ({
    padding: '10px 22px', borderRadius: 10, fontWeight: 600, fontSize: 14,
    border: 'none', cursor: 'pointer', transition: 'all .18s',
    background: active ? '#005BFF' : '#fff',
    color: active ? '#fff' : '#4A5170',
    boxShadow: active ? '0 4px 14px rgba(0,91,255,.28)' : '0 1px 4px rgba(10,16,35,.08)',
  }),
  card: { background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 1px 4px rgba(10,16,35,.08)', marginBottom: 20 },
  cardTitle: { fontWeight: 700, fontSize: 16, marginBottom: 20, color: '#0A1023', paddingBottom: 12, borderBottom: '1px solid #E2E5EF' },
  label: { display: 'block', fontWeight: 600, fontSize: 13, color: '#4A5170', marginBottom: 6 },
  input: { width: '100%', padding: '10px 13px', borderRadius: 9, border: '1.5px solid #E2E5EF', fontSize: 14, color: '#0A1023', background: '#F7F8FB', fontFamily: 'inherit' } as React.CSSProperties,
  btn: (variant: 'primary'|'danger'|'ghost'|'success'): React.CSSProperties => ({
    padding: '9px 20px', borderRadius: 9, fontWeight: 600, fontSize: 13.5,
    border: variant === 'ghost' ? '1.5px solid #E2E5EF' : 'none',
    cursor: 'pointer', transition: 'all .18s',
    background: variant === 'primary' ? '#005BFF' : variant === 'danger' ? '#EF4444' : variant === 'success' ? '#10B981' : 'transparent',
    color: variant === 'ghost' ? '#4A5170' : '#fff',
  } as React.CSSProperties),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 } as React.CSSProperties,
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 } as React.CSSProperties,
  statCard: (color: string): React.CSSProperties => ({
    background: '#fff', borderRadius: 14, padding: '22px 24px',
    boxShadow: '0 1px 4px rgba(10,16,35,.08)', borderTop: `3px solid ${color}`,
  }),
  statNum: { fontSize: 36, fontWeight: 700, lineHeight: 1, marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#8A90A8' },
  badge: (status: Lead['status']): React.CSSProperties => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: 100, fontSize: 11.5, fontWeight: 700,
    background: status === 'new' ? '#EBF3FF' : status === 'contacted' ? '#FEF3C7' : status === 'converted' ? '#D1FAE5' : '#F3F4F6',
    color: status === 'new' ? '#005BFF' : status === 'contacted' ? '#D97706' : status === 'converted' ? '#059669' : '#6B7280',
  }),
  tag: (status: Lead['status']): string =>
    status === 'new' ? 'جديد' : status === 'contacted' ? 'تم التواصل' : status === 'converted' ? 'تحوّل' : 'مغلق',
  toast: { position: 'fixed' as const, bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#10B981', color: '#fff', padding: '12px 24px', borderRadius: 12, fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,.18)' },
};

/* ─── Login Screen ─── */
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) { setAdminAuthenticated(true); onLogin(); }
    else { setErr(true); setTimeout(() => setErr(false), 2000); }
  };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A1023' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '42px 40px', width: 380, textAlign: 'center', boxShadow: '0 30px 60px rgba(0,0,0,.4)' }}>
        <div style={{ fontSize: 38, marginBottom: 8 }}>🔐</div>
        <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 6, color: '#0A1023' }}>لوحة تحكم SpruVex</h2>
        <p style={{ fontSize: 13, color: '#8A90A8', marginBottom: 26 }}>أدخل كلمة المرور للمتابعة</p>
        <form onSubmit={submit}>
          <input
            type="password" value={pw} onChange={e => setPw(e.target.value)}
            placeholder="كلمة المرور" dir="ltr"
            style={{ ...s.input, marginBottom: 14, textAlign: 'center', fontSize: 16, border: err ? '1.5px solid #EF4444' : '1.5px solid #E2E5EF' }}
          />
          {err && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 10 }}>كلمة المرور غير صحيحة</p>}
          <button type="submit" style={{ ...s.btn('primary'), width: '100%', padding: '12px', fontSize: 15 }}>دخول</button>
        </form>
      </div>
    </div>
  );
}

/* ─── Dashboard Tab ─── */
function DashboardTab({ leads }: { leads: Lead[] }) {
  const today = new Date().toDateString();
  const todayLeads = leads.filter(l => new Date(l.timestamp).toDateString() === today);
  const newLeads = leads.filter(l => l.status === 'new');
  const converted = leads.filter(l => l.status === 'converted');
  return (
    <div>
      <div style={s.grid3}>
        <div style={s.statCard('#005BFF')}>
          <div style={s.statNum}>{leads.length}</div>
          <div style={s.statLabel}>إجمالي الطلبات</div>
        </div>
        <div style={s.statCard('#00D4FF')}>
          <div style={s.statNum}>{newLeads.length}</div>
          <div style={s.statLabel}>طلبات جديدة</div>
        </div>
        <div style={s.statCard('#10B981')}>
          <div style={s.statNum}>{todayLeads.length}</div>
          <div style={s.statLabel}>طلبات اليوم</div>
        </div>
      </div>
      <div style={{ ...s.grid2, marginTop: 20 }}>
        <div style={s.statCard('#6A2CFF')}>
          <div style={s.statNum}>{converted.length}</div>
          <div style={s.statLabel}>تحولوا لعملاء</div>
        </div>
        <div style={s.statCard('#F59E0B')}>
          <div style={{ ...s.statNum, fontSize: 24, paddingTop: 6 }}>
            {leads.length ? Math.round((converted.length / leads.length) * 100) : 0}%
          </div>
          <div style={s.statLabel}>نسبة التحويل</div>
        </div>
      </div>
      {leads.length === 0 && (
        <div style={{ ...s.card, textAlign: 'center', padding: '50px 20px', color: '#8A90A8', marginTop: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>لا توجد طلبات بعد</p>
          <p style={{ fontSize: 13 }}>ستظهر هنا فور تعبئة أحد الزوار لأي نموذج في الموقع</p>
        </div>
      )}
      {leads.length > 0 && (
        <div style={{ ...s.card, marginTop: 20 }}>
          <div style={s.cardTitle}>آخر 5 طلبات</div>
          {leads.slice(0, 5).map(l => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid #F0F2F8' }}>
              <span style={{ fontSize: 20 }}>{l.type === 'trial' ? '🧪' : '💬'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name}</div>
                <div style={{ fontSize: 12, color: '#8A90A8' }}>{l.phone} · {new Date(l.timestamp).toLocaleDateString('ar-SA')}</div>
              </div>
              <span style={s.badge(l.status)}>{s.tag(l.status)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Leads Tab ─── */
function LeadsTab({ leads, setLeads }: { leads: Lead[]; setLeads: (l: Lead[]) => void }) {
  const [filter, setFilter] = useState<'all' | Lead['status']>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = () => setLeads(getLeads());
  const handleStatus = (id: string, status: Lead['status']) => { updateLeadStatus(id, status); refresh(); };
  const handleDelete = (id: string) => { if (confirm('حذف الطلب؟')) { deleteLead(id); refresh(); } };

  const filtered = leads.filter(l => {
    if (filter !== 'all' && l.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.phone.includes(q) || l.email.toLowerCase().includes(q);
    }
    return true;
  });

  const statusOptions: { value: Lead['status']; label: string }[] = [
    { value: 'new', label: 'جديد' }, { value: 'contacted', label: 'تم التواصل' },
    { value: 'converted', label: 'تحوّل' }, { value: 'closed', label: 'مغلق' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ابحث بالاسم أو الجوال أو البريد..."
          style={{ ...s.input, maxWidth: 320 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'new', 'contacted', 'converted', 'closed'].map(f => (
            <button key={f} onClick={() => setFilter(f as any)}
              style={s.tab(filter === f)}>
              {f === 'all' ? 'الكل' : f === 'new' ? 'جديد' : f === 'contacted' ? 'تواصل' : f === 'converted' ? 'تحوّل' : 'مغلق'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: '40px 20px', color: '#8A90A8' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <p>لا توجد طلبات مطابقة</p>
        </div>
      ) : filtered.map(l => (
        <div key={l.id} style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', cursor: 'pointer' }}
            onClick={() => setExpanded(expanded === l.id ? null : l.id)}
          >
            <span style={{ fontSize: 22 }}>{l.type === 'trial' ? '🧪' : '💬'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{l.name}</span>
                {l.store && <span style={{ fontSize: 12, color: '#8A90A8' }}>· {l.store}</span>}
                <span style={s.badge(l.status)}>{s.tag(l.status)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#8A90A8', marginTop: 3 }}>
                {l.phone} · {l.email} · {new Date(l.timestamp).toLocaleString('ar-SA')}
              </div>
            </div>
            <span style={{ color: '#8A90A8', fontSize: 18 }}>{expanded === l.id ? '▲' : '▼'}</span>
          </div>

          {expanded === l.id && (
            <div style={{ padding: '0 22px 20px', borderTop: '1px solid #F0F2F8' }}>
              <div style={{ ...s.grid2, marginTop: 16 }}>
                {l.interest && <div><span style={s.label}>الاهتمام</span><div style={{ fontSize: 14 }}>{l.interest}</div></div>}
                {l.channels && l.channels !== 'undefined' && <div><span style={s.label}>القنوات</span><div style={{ fontSize: 14 }}>{l.channels}</div></div>}
                {l.notes && <div style={{ gridColumn: '1/-1' }}><span style={s.label}>ملاحظات</span><div style={{ fontSize: 14 }}>{l.notes}</div></div>}
                {l.message && <div style={{ gridColumn: '1/-1' }}><span style={s.label}>الرسالة</span><div style={{ fontSize: 14 }}>{l.message}</div></div>}
              </div>
              <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#8A90A8', fontWeight: 600 }}>تغيير الحالة:</span>
                {statusOptions.map(opt => (
                  <button key={opt.value} onClick={() => handleStatus(l.id, opt.value)}
                    style={{ ...s.btn(l.status === opt.value ? 'primary' : 'ghost'), fontSize: 12.5, padding: '6px 14px' }}>
                    {opt.label}
                  </button>
                ))}
                <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}>
                  <a href={`https://wa.me/${l.phone.replace(/\D/g, '')}?text=السلام عليكم ${l.name}، نتواصل معك من فريق SpruVex بخصوص طلبك.`}
                    target="_blank" rel="noreferrer"
                    style={{ ...s.btn('success'), display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                    💬 رد واتساب
                  </a>
                  <button onClick={() => handleDelete(l.id)} style={s.btn('danger')}>🗑️ حذف</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Settings Tab ─── */
function SettingsTab({ config, onSave }: { config: SiteConfig; onSave: (c: SiteConfig) => void }) {
  const [form, setForm] = useState(config);
  const set = (path: string, value: any) => {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj: any = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };
  const handleSave = () => { saveConfig(form); onSave(form); };

  return (
    <div>
      {/* WhatsApp */}
      <div style={s.card}>
        <div style={s.cardTitle}>📱 واتساب</div>
        <div style={{ maxWidth: 400 }}>
          <label style={s.label}>رقم الواتساب (بدون +، مثال: 966501234567)</label>
          <input dir="ltr" style={s.input} value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
          <p style={{ fontSize: 12, color: '#8A90A8', marginTop: 6 }}>
            سيُستخدم في زر الواتساب العائم وكل روابط التواصل في الموقع
          </p>
        </div>
      </div>

      {/* Offer */}
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #E2E5EF', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>🎉 العرض الترويجي</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.offer.enabled} onChange={e => set('offer.enabled', e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#005BFF', cursor: 'pointer' }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: form.offer.enabled ? '#005BFF' : '#8A90A8' }}>
              {form.offer.enabled ? 'مفعّل' : 'موقوف'}
            </span>
          </label>
        </div>
        <div style={s.grid2}>
          <div>
            <label style={s.label}>عنوان العرض (عربي)</label>
            <input style={s.input} value={form.offer.titleAr} onChange={e => set('offer.titleAr', e.target.value)} />
          </div>
          <div>
            <label style={s.label}>عنوان العرض (إنجليزي)</label>
            <input dir="ltr" style={s.input} value={form.offer.titleEn} onChange={e => set('offer.titleEn', e.target.value)} />
          </div>
          <div>
            <label style={s.label}>وصف العرض (عربي)</label>
            <input style={s.input} value={form.offer.descAr} onChange={e => set('offer.descAr', e.target.value)} />
          </div>
          <div>
            <label style={s.label}>وصف العرض (إنجليزي)</label>
            <input dir="ltr" style={s.input} value={form.offer.descEn} onChange={e => set('offer.descEn', e.target.value)} />
          </div>
          <div>
            <label style={s.label}>كود الخصم</label>
            <input dir="ltr" style={{ ...s.input, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, letterSpacing: 2 }}
              value={form.offer.code} onChange={e => set('offer.code', e.target.value.toUpperCase())} />
          </div>
          <div>
            <label style={s.label}>نسبة الخصم %</label>
            <input type="number" min="1" max="99" style={s.input} value={form.offer.discount}
              onChange={e => set('offer.discount', Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleSave} style={{ ...s.btn('primary'), padding: '12px 32px', fontSize: 15 }}>💾 حفظ التغييرات</button>
        <button onClick={() => setForm(config)} style={{ ...s.btn('ghost'), padding: '12px 20px', fontSize: 15 }}>تراجع</button>
      </div>
    </div>
  );
}

/* ─── Pricing Tab ─── */
const CYCLES: { key: keyof PricingRow; label: string }[] = [
  { key: 'm1', label: 'شهري' }, { key: 'm3', label: '3 أشهر' },
  { key: 'm6', label: '6 أشهر' }, { key: 'y1', label: 'سنوي' }, { key: 'life', label: 'مدى الحياة' },
];
const PLANS: { key: 'basic' | 'pro' | 'enterprise'; label: string }[] = [
  { key: 'basic', label: 'الأساسية' }, { key: 'pro', label: 'المتقدمة' }, { key: 'enterprise', label: 'الاحترافية' },
];

function PricingTab({ config, onSave }: { config: SiteConfig; onSave: (c: SiteConfig) => void }) {
  const [pricing, setPricing] = useState(config.pricing);
  const [fees, setFees] = useState(config.lifetimeFees);

  const handleSave = () => {
    const updated = { ...config, pricing, lifetimeFees: fees };
    saveConfig(updated); onSave(updated);
  };

  const setPrice = (plan: 'basic'|'pro'|'enterprise', cycle: keyof PricingRow, val: number) => {
    setPricing(prev => ({ ...prev, [plan]: { ...prev[plan], [cycle]: val } }));
  };

  return (
    <div>
      <div style={s.card}>
        <div style={s.cardTitle}>💰 أسعار الباقات (ر.س)</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#F7F8FB' }}>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, borderBottom: '2px solid #E2E5EF', color: '#0A1023' }}>الباقة</th>
                {CYCLES.map(c => (
                  <th key={c.key} style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #E2E5EF', color: '#0A1023' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLANS.map((plan, i) => (
                <tr key={plan.key} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFD' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0A1023', borderBottom: '1px solid #F0F2F8' }}>{plan.label}</td>
                  {CYCLES.map(c => (
                    <td key={c.key} style={{ padding: '8px 12px', borderBottom: '1px solid #F0F2F8', textAlign: 'center' }}>
                      <input
                        type="number" min="0"
                        value={pricing[plan.key][c.key]}
                        onChange={e => setPrice(plan.key, c.key, Number(e.target.value))}
                        style={{ ...s.input, width: 90, textAlign: 'center', padding: '8px', fontFamily: 'IBM Plex Mono,monospace', fontWeight: 600 }}
                        dir="ltr"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>🔁 الرسوم السنوية لباقة مدى الحياة (ر.س)</div>
        <div style={s.grid3}>
          {PLANS.map(plan => (
            <div key={plan.key}>
              <label style={s.label}>{plan.label}</label>
              <input type="number" min="0" dir="ltr"
                style={{ ...s.input, fontFamily: 'IBM Plex Mono,monospace', fontWeight: 600 }}
                value={fees[plan.key]}
                onChange={e => setFees(prev => ({ ...prev, [plan.key]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} style={{ ...s.btn('primary'), padding: '12px 32px', fontSize: 15 }}>💾 حفظ الأسعار</button>
    </div>
  );
}

/* ─── Features Tab ─── */
function FeaturesTab({ config, onSave }: { config: SiteConfig; onSave: (c: SiteConfig) => void }) {
  const [features, setFeatures] = useState(config.planFeatures);

  const setFeature = (plan: 'basic'|'pro'|'enterprise', idx: number, val: string) => {
    setFeatures(prev => {
      const next = { ...prev };
      next[plan] = [...next[plan]];
      next[plan][idx] = val;
      return next;
    });
  };
  const addFeature = (plan: 'basic'|'pro'|'enterprise') => {
    setFeatures(prev => ({ ...prev, [plan]: [...prev[plan], ''] }));
  };
  const removeFeature = (plan: 'basic'|'pro'|'enterprise', idx: number) => {
    setFeatures(prev => ({ ...prev, [plan]: prev[plan].filter((_, i) => i !== idx) }));
  };
  const handleSave = () => {
    const updated = { ...config, planFeatures: features };
    saveConfig(updated); onSave(updated);
  };
  const handleReset = () => setFeatures(DEFAULT_CONFIG.planFeatures);

  return (
    <div>
      <div style={s.grid3}>
        {PLANS.map(plan => (
          <div key={plan.key} style={s.card}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#005BFF' }}>{plan.label}</div>
            {features[plan.key].map((f, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input value={f} onChange={e => setFeature(plan.key, idx, e.target.value)}
                  style={{ ...s.input, flex: 1, fontSize: 13, padding: '8px 10px' }} />
                <button onClick={() => removeFeature(plan.key, idx)}
                  style={{ ...s.btn('danger'), padding: '7px 10px', fontSize: 13 }}>✕</button>
              </div>
            ))}
            <button onClick={() => addFeature(plan.key)}
              style={{ ...s.btn('ghost'), width: '100%', marginTop: 4, fontSize: 13 }}>
              + إضافة ميزة
            </button>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12.5, color: '#8A90A8', marginBottom: 16 }}>
        ملاحظة: هذه الميزات تظهر باللغة العربية. الميزات بالإنجليزية لا تتأثر.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleSave} style={{ ...s.btn('primary'), padding: '12px 32px', fontSize: 15 }}>💾 حفظ الميزات</button>
        <button onClick={handleReset} style={{ ...s.btn('ghost'), padding: '12px 20px', fontSize: 15 }}>إعادة ضبط الافتراضي</button>
      </div>
    </div>
  );
}

/* ─── Main AdminPanel ─── */
type Tab = 'dashboard' | 'leads' | 'settings' | 'pricing' | 'features';

export default function AdminPanel() {
  const [authed, setAuthed] = useState(isAdminAuthenticated());
  const [tab, setTab] = useState<Tab>('dashboard');
  const [config, setConfig] = useState(getConfig());
  const [leads, setLeads] = useState<Lead[]>(getLeads());
  const [toast, setToast] = useState('');

  // Refresh leads when tab changes to leads
  useEffect(() => {
    if (tab === 'leads' || tab === 'dashboard') setLeads(getLeads());
  }, [tab]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const handleSave = (newConfig: SiteConfig) => {
    setConfig(newConfig);
    showToast('✅ تم حفظ التغييرات بنجاح');
  };

  const handleLogout = () => { setAdminAuthenticated(false); setAuthed(false); };
  const goBack = () => { window.location.href = window.location.pathname; };

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: '📊 الإحصاء' },
    { key: 'leads', label: `📬 الطلبات ${leads.filter(l => l.status === 'new').length > 0 ? `(${leads.filter(l => l.status === 'new').length})` : ''}` },
    { key: 'settings', label: '⚙️ الإعدادات' },
    { key: 'pricing', label: '💰 الأسعار' },
    { key: 'features', label: '📋 الباقات' },
  ];

  return (
    <div style={s.wrap}>
      {/* Navbar */}
      <div style={s.nav}>
        <div style={s.navBrand}>🛠️ لوحة تحكم SpruVex</div>
        <div style={s.navRight}>
          <button onClick={goBack} style={{ ...s.btn('ghost'), background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)' }}>
            ← الموقع
          </button>
          <button onClick={handleLogout} style={{ ...s.btn('ghost'), background: 'rgba(239,68,68,.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,.3)' }}>
            تسجيل خروج
          </button>
        </div>
      </div>

      <div style={s.body}>
        {/* Tabs */}
        <div style={s.tabs}>
          {TABS.map(t => (
            <button key={t.key} style={s.tab(tab === t.key)} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        {tab === 'dashboard' && <DashboardTab leads={leads} />}
        {tab === 'leads'     && <LeadsTab leads={leads} setLeads={setLeads} />}
        {tab === 'settings'  && <SettingsTab config={config} onSave={handleSave} />}
        {tab === 'pricing'   && <PricingTab config={config} onSave={handleSave} />}
        {tab === 'features'  && <FeaturesTab config={config} onSave={handleSave} />}
      </div>

      {/* Toast */}
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}

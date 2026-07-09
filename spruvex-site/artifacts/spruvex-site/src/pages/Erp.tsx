import ModuleTemplate from '../components/ModuleTemplate';

export default function Erp() {
  return (
    <ModuleTemplate
      eyebrowKey="erp_eyebrow" titleKey="erp_title" subKey="erp_sub"
      metaTitleKey="erp_meta_title" metaDescKey="erp_meta_desc"
      ctaTitleKey="erp_cta_title" ctaSubKey="erp_cta_sub" ctaBtnKey="common_cta_start"
      plan="erp_business"
      features={[
        { icon: '🧾', hKey: 'erp_f1_h', pKey: 'erp_f1_p' },
        { icon: '📦', hKey: 'erp_f2_h', pKey: 'erp_f2_p' },
        { icon: '🛒', hKey: 'erp_f3_h', pKey: 'erp_f3_p' },
        { icon: '✅', hKey: 'erp_f4_h', pKey: 'erp_f4_p' },
        { icon: '💳', hKey: 'erp_f5_h', pKey: 'erp_f5_p' },
        { icon: '📊', hKey: 'erp_f6_h', pKey: 'erp_f6_p' },
      ]}
    />
  );
}

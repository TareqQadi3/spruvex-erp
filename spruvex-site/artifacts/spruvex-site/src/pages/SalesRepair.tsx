import ModuleTemplate from '../components/ModuleTemplate';

export default function SalesRepair() {
  return (
    <ModuleTemplate
      eyebrowKey="sr_eyebrow" titleKey="sr_title" subKey="sr_sub"
      metaTitleKey="sr_meta_title" metaDescKey="sr_meta_desc"
      ctaTitleKey="sr_cta_title" ctaSubKey="sr_cta_sub" ctaBtnKey="common_cta_start"
      plan="sales_repair"
      features={[
        { icon: '🎫', hKey: 'sr_f1_h', pKey: 'sr_f1_p' },
        { icon: '✅', hKey: 'sr_f2_h', pKey: 'sr_f2_p' },
        { icon: '🔩', hKey: 'sr_f3_h', pKey: 'sr_f3_p' },
        { icon: '💬', hKey: 'sr_f4_h', pKey: 'sr_f4_p' },
        { icon: '🧾', hKey: 'sr_f5_h', pKey: 'sr_f5_p' },
      ]}
    />
  );
}

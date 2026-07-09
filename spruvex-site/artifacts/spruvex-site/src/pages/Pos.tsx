import ModuleTemplate from '../components/ModuleTemplate';

export default function Pos() {
  return (
    <ModuleTemplate
      eyebrowKey="pos_eyebrow" titleKey="pos_title" subKey="pos_sub"
      metaTitleKey="pos_meta_title" metaDescKey="pos_meta_desc"
      ctaTitleKey="pos_cta_title" ctaSubKey="pos_cta_sub" ctaBtnKey="common_cta_start"
      features={[
        { icon: '📶', hKey: 'pos_f1_h', pKey: 'pos_f1_p' },
        { icon: '💳', hKey: 'pos_f2_h', pKey: 'pos_f2_p' },
        { icon: '💬', hKey: 'pos_f3_h', pKey: 'pos_f3_p' },
        { icon: '🗄️', hKey: 'pos_f4_h', pKey: 'pos_f4_p' },
        { icon: '📦', hKey: 'pos_f5_h', pKey: 'pos_f5_p' },
      ]}
    />
  );
}

import ModuleTemplate from '../components/ModuleTemplate';

export default function Restaurant() {
  return (
    <ModuleTemplate
      eyebrowKey="restaurant_eyebrow" titleKey="restaurant_title" subKey="restaurant_sub"
      metaTitleKey="restaurant_meta_title" metaDescKey="restaurant_meta_desc"
      ctaTitleKey="restaurant_cta_title" ctaSubKey="restaurant_cta_sub" ctaBtnKey="common_cta_start"
      plan="restaurant"
      features={[
        { icon: '🪑', hKey: 'restaurant_f1_h', pKey: 'restaurant_f1_p' },
        { icon: '🍳', hKey: 'restaurant_f2_h', pKey: 'restaurant_f2_p' },
        { icon: '🛵', hKey: 'restaurant_f3_h', pKey: 'restaurant_f3_p' },
        { icon: '📋', hKey: 'restaurant_f4_h', pKey: 'restaurant_f4_p' },
        { icon: '📊', hKey: 'restaurant_f5_h', pKey: 'restaurant_f5_p' },
      ]}
    />
  );
}

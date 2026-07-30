// Minimal inline-styled HTML (no external stylesheet — most email clients
// strip <style> in <head>) shared by every transactional email SpruVex R
// sends. Arabic/RTL by default since that's the product's primary market.

const wrapper = (body: string) => `
<div dir="rtl" style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f6f7f4;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <div style="font-size:20px;font-weight:700;color:#16803c;margin-bottom:24px;">SpruVex R</div>
    ${body}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">
      فريق SpruVex — Growth • Vision • Prosperity
    </div>
  </div>
</div>`;

export function otpEmail(code: string, purpose: "email_verification" | "password_reset" | "login"): { subject: string; html: string } {
  const purposeTitle = purpose === "password_reset" ? "إعادة تعيين كلمة المرور" : "تأكيد البريد الإلكتروني";
  return {
    subject: `${purposeTitle} — رمز التحقق: ${code}`,
    html: wrapper(`
      <p style="font-size:15px;color:#333;">مرحباً،</p>
      <p style="font-size:15px;color:#333;">رمز التحقق الخاص بك لـ${purposeTitle}:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#f0f9f0;color:#16803c;padding:16px;border-radius:8px;margin:16px 0;">${code}</div>
      <p style="font-size:13px;color:#888;">صالح لمدة 10 دقائق. إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.</p>
    `),
  };
}

export function welcomeEmail(ownerName: string, tenantName: string, loginUrl: string): { subject: string; html: string } {
  return {
    subject: `أهلاً بك في SpruVex R، ${ownerName}!`,
    html: wrapper(`
      <p style="font-size:15px;color:#333;">مرحباً ${ownerName}،</p>
      <p style="font-size:15px;color:#333;">تم إنشاء حساب <strong>${tenantName}</strong> بنجاح على SpruVex R — نظام تشغيل المطاعم المتكامل.</p>
      <a href="${loginUrl}" style="display:inline-block;background:#16803c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;margin:16px 0;">الدخول للوحة التحكم</a>
      <p style="font-size:13px;color:#888;">فترتك التجريبية بدأت الآن — استكشف المنيو، الطاولات، ونقطة البيع.</p>
    `),
  };
}

export function staffCredentialsEmail(
  staffName: string,
  tenantName: string,
  email: string,
  password: string,
  loginUrl: string,
): { subject: string; html: string } {
  return {
    subject: `دعوة للانضمام إلى فريق ${tenantName} على SpruVex R`,
    html: wrapper(`
      <p style="font-size:15px;color:#333;">مرحباً ${staffName}،</p>
      <p style="font-size:15px;color:#333;">أُضفت إلى فريق <strong>${tenantName}</strong> على SpruVex R. بيانات الدخول:</p>
      <div style="background:#f6f7f4;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;">
        <div>البريد: <strong dir="ltr">${email}</strong></div>
        <div>كلمة المرور المؤقتة: <strong dir="ltr">${password}</strong></div>
      </div>
      <a href="${loginUrl}" style="display:inline-block;background:#16803c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;">تسجيل الدخول</a>
      <p style="font-size:13px;color:#888;margin-top:16px;">يُنصح بتغيير كلمة المرور بعد أول دخول.</p>
    `),
  };
}

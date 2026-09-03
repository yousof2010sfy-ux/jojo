# 🚀 دليل رفع المشروع على Vercel و Supabase

تم تجهيز المشروع بالكامل وبأعلى المعايير ليكون جاهزاً للرفع المباشر والتشغيل التلقائي على **Vercel** لقسم الواجهة (Frontend) و **Supabase** لقاعدة البيانات والمصادقة (Backend & Database).

---

## 1️⃣ إعداد قاعدة البيانات على Supabase

1. ادخل إلى حسابك في [Supabase](https://supabase.com) وأنشئ مشروعاً جديداً (**New Project**).
2. من القائمة الجانبية في لوحة تحكم المشروع، اضغط على **SQL Editor** (أيقونة الكود).
3. اضغط على **New query**.
4. افتح الملف المرفق في المشروع باسم **`supabase_schema.sql`**، وانسخ كل ما بداخله والصقه في محرر SQL في Supabase.
5. اضغط على زر **Run** (تشغيل).
   - سيقوم بإنشاء جميع الجداول (`profiles`, `orders`, `balance_requests`, `messages`, `faqs`, `discount_codes`, إلخ).
   - سيقوم بإنشاء جميع الدوال البرمجية (RPCs) وحسابات الأرباح، والإحالات، والرصيد، والحظر، والأسعار.
   - سيقوم بإنشاء مجلدات التخزين للصور `avatars` وإيصالات الدفع `payment-proofs` مع سياسات الأمان RLS.
6. اذهب إلى **Project Settings -> API**:
   - انسخ **Project URL**.
   - انسخ **anon public key**.
7. افتح ملف **`supabase-config.js`** في المشروع وضع الرابط والمفتاح الخاصين بمشروعك:
   ```javascript
   window.SUPABASE_CONFIG = {
     URL: "https://your-project.supabase.co",
     ANON_KEY: "your-anon-public-key"
   };
   ```
8. **لترقية حسابك إلى مسؤول (Admin):**
   - بعد أن تسجل حسابك لأول مرة في الموقع برقم هاتفك.
   - افتح SQL Editor في Supabase واكتب:
     ```sql
     select public.promote_user_to_admin('01012345678'); -- ضع رقم هاتفك هنا
     ```
     واضغط Run، وسيصبح حسابك أدمين فوراً للدخول إلى لوحة التحكم `/admin/`.

---

## 2️⃣ الرفع على Vercel

المشروع يحتوي بالفعل على ملف **`vercel.json`** وملف إعدادات البناء **`vite.config.ts`** المُهيأين للمواقع متعددة الصفحات (Multi-Page App).

### الطريقة الأولى (عبر GitHub - الأسهل والأفضل):
1. ارفع المشروع على مستودع خاص أو عام في حسابك على **GitHub**.
2. اذهب إلى [Vercel Dashboard](https://vercel.com/dashboard) واضغط **Add New... -> Project**.
3. اختر مستودع المشروع من GitHub واضغط **Import**.
4. سيتعرف Vercel تلقائياً على المشروع:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. اضغط على **Deploy**!
   - خلال ثوانٍ معدودة سينتهي الرفع وسيعطيك رابط موقعك المباشر المجاني المنتهي بـ `.vercel.app`.

### الطريقة الثانية (عبر سطر الأوامر Vercel CLI):
```bash
npm install -g vercel
vercel
```
ثم اضغط Enter للموافقة على الإعدادات الافتراضية وسيقوم برفعه فوراً.

---

## 🌐 الروابط المتاحة على Vercel بعد الرفع:
- **الصفحة الرئيسية (المتجر والخدمات)**: `/` أو `/index.html`
- **سجل ومتابعة الطلبات**: `/orders` أو `/orders.html`
- **شحن الرصيد وفودافون كاش وتيلدا**: `/balance` أو `/balance.html`
- **الدعم الفني والأسئلة الشائعة**: `/contact` أو `/contact.html`
- **الملف الشخصي والإعدادات**: `/profile` أو `/profile.html`
- **برنامج الإحالة والأرباح**: `/referral` أو `/referral.html`
- **لوحة تحكم المدير**: `/admin` أو `/admin/index.html`

# Brand Rise — Client Request Portal

بوابة طلبات العملاء: صفحة HTML واحدة تترفع على GitHub Pages أو Vercel، ومربوطة بـ Google Sheet عن طريق Google Apps Script.

```
brandrise-portal/
├── index.html            ← الموقع كله (لوجين + فورم + لوحة تحكم)
├── config.js             ← هنا بتحط لينك الـ API
├── assets/logos/         ← لوجوهات Brand Rise والعملاء
└── apps-script/Code.gs   ← الكود اللي بيتحط في Google Apps Script
```

افتح `index.html` من جهازك دلوقتي حالًا وهيشتغل بـ **بيانات تجريبية** لحد ما توصّله بالشيت.

---

## 1) تجهيز الـ Google Sheet

1. اعمل Google Sheet جديد باسم مثلاً `Brand Rise – Requests`.
2. من فوق: **Extensions → Apps Script**.
3. امسح أي كود موجود، والصق محتوى `apps-script/Code.gs`.
4. من قائمة الفانكشنز فوق اختار **`initSheets`** واضغط **Run**.
   - أول مرة هيطلب صلاحيات: **Review permissions → اختار حسابك → Advanced → Go to project → Allow**.
5. ارجع للشيت، هتلاقي كل التابات اتعملت لوحدها ومعاها بيانات تجريبية:
   `Users` · `Companies` · `SalesChannels` · `Branches` · `Urgency` · `Requests` · `ActivityLog`

## 2) نشر الـ API

في Apps Script: **Deploy → New deployment → اختار النوع Web app**

| الإعداد | القيمة |
|---|---|
| Execute as | **Me** |
| Who has access | **Anyone** |

اضغط Deploy وانسخ اللينك اللي بينتهي بـ `/exec`.

> ⚠️ كل مرة تعدّل في `Code.gs` لازم تعمل **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**، وإلا التعديل مش هيظهر.

## 3) ربط الموقع

افتح `config.js` وحط اللينك:

```js
window.BR_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfy..../exec",
  ...
};
```

## 4) الرفع

**GitHub Pages:** ارفع الفولدر على repo → Settings → Pages → Source: `main` / root → هيطلعلك لينك خلال دقيقة.

**Vercel:** New Project → Import من GitHub → Framework Preset: **Other** → Deploy. (مفيش build، الموقع static.)

---

## التابات وشرح الأعمدة

### `Users` — الحسابات والصلاحيات
| العمود | الشرح |
|---|---|
| `username` | اسم الدخول (بدون مسافات) |
| `password` | كلمة المرور. تقدر تحطها مشفّرة: شغّل `hashPassword()` بعد ما تغيّر السطر `var pw = '...'` وانسخ الناتج `sha256:xxxx` |
| `full_name` | الاسم اللي بيظهر في الطلب |
| `email` | اختياري |
| `role` | `client` أو `admin` (الأدمن بيشوف لوحة التحكم وكل الطلبات) |
| `companies` | **ده مفتاح الصلاحيات:** أكواد الشركات المسموح له بيها مفصولة بفاصلة، مثال `CH,VC` — أو `ALL` لكل الشركات. أي شركة مش مكتوبة هنا العميل **مش هيشوفها أصلاً** في الـ dropdown ومش هيقدر يطلبلها حتى لو حاول |
| `active` | `no` = الحساب موقوف |

### `Companies` — الشركات والبراندنج
| العمود | الشرح |
|---|---|
| `code` | كود مختصر وفريد (`CH`, `EEP`, `VC`) — ده اللي بيتربط بيه كل حاجة |
| `name_en` / `name_ar` | الاسم اللي بيظهر |
| `logo_url` | مسار اللوجو، زي `assets/logos/carehub.png` أو أي لينك مباشر لصورة |
| `color` | لون البراند بالـ HEX — الموقع بيلوّن بيه الواجهة لما العميل يختار الشركة |
| `active` | `no` = مخفية |

### `SalesChannels` و `Branches`
عمود `company_code` يا إما كود شركة معينة، يا إما `ALL` يعني تظهر لكل الشركات.
لما العميل يختار الشركة، الليستة بتتفلتر أوتوماتيك.

### `Urgency`
`level` (الاسم) + `sla_days` (بيظهر جنبه في الفورم: «خلال ٢ يوم») + `color`.

### `Requests` — كل الطلبات بتتسجّل هنا
`request_id` بيتولّد أوتوماتيك بصيغة `BR-2608-0001`. عمودي `status` و `assignee` بيتحدّثوا من لوحة التحكم على طول.

---

## حسابات التجربة (غيّرها فورًا)

| المستخدم | الباسورد | الصلاحية |
|---|---|---|
| `admin` | `admin123` | أدمن — كل الشركات |
| `carehub` | `care123` | CareHub بس |
| `eep` | `eep123` | EEP بس |
| `vcrest` | `vc123` | ValueCrest + CareHub |

---

## إضافة شركة جديدة

1. حط اللوجو في `assets/logos/` (مربّع، PNG، ~560px).
2. صف جديد في `Companies` بالكود والاسم ومسار اللوجو ولون البراند.
3. صفوف في `SalesChannels` و `Branches` بنفس الكود.
4. في `Users`، ضيف الكود لعمود `companies` لمين المفروض يشوفها.

مش محتاج تعدّل الموقع نفسه خالص — كل ده من الشيت.

---

## البراندنج المزدوج

الصفحة كلها بلون Brand Rise (أسود/فضي/دهبي). أول ما العميل يختار شركته:
لوجو الشركة بيظهر جنب لوجو Brand Rise مفصولين بالخط الدهبي المائل، والاسم بيتحوّل لـ **Brand Rise × CareHub**، ولون الواجهة بياخد لون براند الشركة من عمود `color`.

---

## ملاحظات مهمة

- **الأمان:** ده نظام داخلي. الباسوردات في الشيت — استخدم `sha256:` بدل النص الصريح، وما تشاركش لينك الشيت مع العملاء. الجلسة بتقفل بعد ١٢ ساعة (غيّرها من `TOKEN_TTL_HOURS`).
- **مين يقدر يشوف إيه:** الفلترة بتحصل في السيرفر مش في المتصفح — حتى لو حد عبث بالصفحة، Apps Script بيرفض أي طلب لشركة مش مسموح له بيها.
- **الاتصال:** الموقع بيكلّم Apps Script بـ POST عادي، ولو المتصفح اعترض بيرجع أوتوماتيك على JSONP.

### لو حصلت مشكلة

| المشكلة | الحل |
|---|---|
| «تعذّر الاتصال بالسيرفر» | اتأكد إن الـ deployment على **Anyone**، وإن اللينك بينتهي بـ `/exec` مش `/dev` |
| «التاب غير موجود» | شغّل `initSheets()` تاني |
| عدّلت في الكود ومفيش حاجة اتغيّرت | اعمل **New version** من Manage deployments |
| اللوجو مش ظاهر | تأكد إن اسم الملف في `logo_url` مطابق للملف اللي في `assets/logos/` بالحروف الكبيرة والصغيرة |

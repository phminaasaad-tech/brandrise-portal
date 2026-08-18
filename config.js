/* ------------------------------------------------------------------
   BRAND RISE PORTAL — الإعدادات
   الملف ده هو الوحيد اللي بتعدّل فيه عشان توصّل الموقع بالشيت.
------------------------------------------------------------------ */
window.BR_CONFIG = {

  // لينك الـ Web App بتاع Google Apps Script (لازم ينتهي بـ /exec)
  API_URL: "https://script.google.com/macros/s/AKfycbysxkrmM48ZU79Pj4N_MBIIeW6gDRAEaB__V1E9NO3oHYYwA0vAdFyfH8HkGjjMoxsarQ/exec",

  // شعار Brand Rise الثابت في كل الصفحات
  BRAND_LOGO: "assets/logos/brandrise.png",

  // الاسم اللي بيظهر فوق جنب اللوجو
  PORTAL_NAME: "Client Request Portal",

  // لو المتصفح اعترض على الاتصال المباشر، الموقع هيجرب JSONP أوتوماتيك
  ALLOW_JSONP_FALLBACK: true
};

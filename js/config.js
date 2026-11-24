/* =====================================================================
   JyotishVeda — Site configuration. Edit this file before going live.
   ===================================================================== */
window.JV_CONFIG = {
  brand: 'JyotishVeda',
  price: 499,                 // INR
  originalPrice: 1999,        // shown struck through
  currency: 'INR',

  /* Razorpay: paste your live/test Key ID to enable card/UPI/netbanking checkout.
     Leave empty to fall back to the UPI-ID payment screen. */
  razorpayKeyId: '',

  /* UPI fallback: your VPA (e.g. 'yourname@okaxis'). Shown with a deep link that
     opens the user's UPI app with the amount pre-filled. */
  upiId: '',
  payeeName: 'JyotishVeda',

  /* WhatsApp number (country code, no +) for support / manual payment confirmation. */
  whatsapp: '',

  /* Set to true ONLY while testing: shows a "Continue in test mode" button that
     unlocks the full report without payment. Set to false before launch. */
  demoUnlock: true
};

// frontend/js/config.js
const CONFIG = {
 // BASE_URL: 'http://localhost:5000/api',
  BASE_URL: 'https://my-store-website.onrender.com/api',
  CURRENCY: '₹',
  // Default fallback tabhi tak jab tak API se setting load na ho jaye
  globalAdvancePayment: 300,
  adminUpiId: '',
  adminQrCodeUrl: '',
  adminWhatsapp: ''
};


// 🌟 NAYI LINE - Isse fetch API cookies send karne lagti hai
window.fetchConfig = { credentials: 'omit' }; // default, isko hata denge
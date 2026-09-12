// ============================================================
// PRIVATE CONFIG — DO NOT COMMIT THIS FILE TO GITHUB
// Keep this file on your PC and on Vercel only (see README).
// ============================================================
window.APP_CONFIG = {
  // Local email backend (npm start in email-backend/). On production use your API URL.
  apiBaseUrl: "http://127.0.0.1:5050",
  // Keep false so signup/admin share users in the browser (recommended).
  // Set true only when Firestore is fully set up with open rules for testing.
  enableFirebase: false,
  defaultAdminPassword: "ieb8228!iw#@9",
  defaultAdminEmail: "",

  firebase: {
    apiKey: "AIzaSyAJ93-MMq6GKqRGq7LWNIs8fbniu5AIatw",
    authDomain: "laurenapexglobal.firebaseapp.com",
    databaseURL: "https://laurenapexglobal-default-rtdb.firebaseio.com",
    projectId: "laurenapexglobal",
    storageBucket: "laurenapexglobal.firebasestorage.app",
    messagingSenderId: "211489212776",
    appId: "1:211489212776:web:c0b23cb291b1848e5ceedd",
    measurementId: "G-PSG1GBKB4D"
  },

  depositAddresses: {
    usdt_trc20: "TNSX1AuXAZXrzkzCAaKEeMtCrp7CDfKTwU",
    usdt_erc20: "0xAd0063BB89cF6fc473B65a43b4EC76326688C013",
    btc: "bc1q22w7u9rzaxm7g7cdzm5hfkghqxp9fv7k24yvsp"
  },

  whatsappNumber: "15186304939",

  // Optional: real Gmail verification codes via EmailJS (https://www.emailjs.com)
  // 1) Create free account → Email Service (Gmail) → Email Template with {{verification_code}} and {{to_email}}
  // 2) Paste your Public Key, Service ID, Template ID below
  emailjs: {
    publicKey: "WgzIIW_wg0OGQERSm",
    serviceId: "service_870qowj",
    templateId: "template_nrlv4em",
    // Optional separate template for withdrawals (else uses templateId)
    // Template vars: {{to_email}} {{to_name}} {{amount}} {{message}} {{withdraw_details}}
    withdrawTemplateId: "template_gprz89o"
  }
};

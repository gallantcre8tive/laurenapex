// ============================================================
// EXAMPLE ONLY — safe to commit to GitHub
// Copy this file to config.js and fill in your real values:
//   copy config.example.js config.js
// ============================================================
window.APP_CONFIG = {
  apiBaseUrl: "http://127.0.0.1:5050",
  defaultAdminPassword: "CHANGE_ME_TO_A_STRONG_PASSWORD",
  defaultAdminEmail: "",

  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:xxxxxxxxxxxx",
    measurementId: "G-XXXXXXXXXX"
  },

  depositAddresses: {
    usdt_trc20: "YOUR_TRON_USDT_ADDRESS",
    usdt_erc20: "YOUR_ETH_USDT_ADDRESS",
    btc: "YOUR_BTC_ADDRESS"
  },

  whatsappNumber: "15186304939",

  emailjs: {
    publicKey: "YOUR_EMAILJS_PUBLIC_KEY",
    serviceId: "YOUR_EMAILJS_SERVICE_ID",
    templateId: "YOUR_EMAILJS_TEMPLATE_ID"
  }
};

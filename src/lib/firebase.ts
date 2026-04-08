import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAJZQhhjIB4fr3f8LATvsh6FiubQIapS3k",
  authDomain: "bank-recon-saas-multi-tenant.firebaseapp.com",
  projectId: "bank-recon-saas-multi-tenant",
  storageBucket: "bank-recon-saas-multi-tenant.firebasestorage.app",
  messagingSenderId: "358770199333",
  appId: "1:358770199333:web:f3f6a938f583389373e8cc"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;

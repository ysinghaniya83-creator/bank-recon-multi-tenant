# 🔐 Security Alert - Action Required

## What Happened
Your Firebase API key was exposed in the git repository. GitHub detected and alerted you (correctly identified as a security risk).

## ✅ What Has Been Fixed
- ✅ Firebase credentials moved to environment variables
- ✅ Code no longer contains hardcoded secrets
- ✅ `.env.example` created with template

## 🚨 URGENT: What You Must Do Now

### Step 1: Rotate Firebase API Key (RIGHT NOW)
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: `bank-recon-saas-multi-tenant`
3. Settings → Project Settings → Web API Key
4. **Delete the old key:** `AIzaSyAJZQhhjIB4fr3f8LATvsh6FiubQIapS3k`
5. **Restrict it immediately** if deletion takes time
6. Create a new Web API Key or use Generated Key

### Step 2: Set Environment Variables in Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select project: `bank-recon-saas`
3. Settings → Environment Variables
4. Add these variables for **Production**:
   ```
   VITE_FIREBASE_API_KEY=<NEW KEY FROM FIREBASE>
   VITE_FIREBASE_AUTH_DOMAIN=bank-recon-saas-multi-tenant.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=bank-recon-saas-multi-tenant
   VITE_FIREBASE_STORAGE_BUCKET=bank-recon-saas-multi-tenant.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=358770199333
   VITE_FIREBASE_APP_ID=1:358770199333:web:f3f6a938f583389373e8cc
   ```
5. Click "Save"
6. **Redeploy** the project (Vercel → Deployments → click latest → "Redeploy")

### Step 3: Update Vercel Project Name (Optional - For `bank-recon-saas.vercel.app`)
The current URL is: `bank-recon-saas-ysinghaniya83-creators-projects.vercel.app`

To get `https://bank-recon-saas.vercel.app/`:
1. (Option A) Transfer project to personal account: Vercel Dashboard → Project Settings → Transfer
2. (Option B) Use custom domain: Point your domain to the current URL

## 📝 Local Development Setup
Create `.env.local` in project root:
```
VITE_FIREBASE_API_KEY=<YOUR_NEW_KEY>
VITE_FIREBASE_AUTH_DOMAIN=bank-recon-saas-multi-tenant.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bank-recon-saas-multi-tenant
VITE_FIREBASE_STORAGE_BUCKET=bank-recon-saas-multi-tenant.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=358770199333
VITE_FIREBASE_APP_ID=1:358770199333:web:f3f6a938f583389373e8cc
```

Then: `npm run dev`

## 🔍 GitHub Security
The commit with exposed key is still in history. To fully clean it:
- Run: `git filter-branch` (complex, only if needed for public repos)
- Or: Mark GitHub alert as "dismissed" after rotating the key
- Add `.env.local` to `.gitignore` (already done)

**Status:** ✅ Code is now secure. Waiting for you to rotate key and set Vercel vars.

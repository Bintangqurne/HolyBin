# TrashSync — Smart Trash Management System

Sistem manajemen pengambilan sampah berbasis kode unik dengan dashboard admin dan validasi petugas.

---

## Stack

- **Next.js 14** (App Router)
- **Firebase** (Firestore + Auth)
- **Tailwind CSS**
- **TypeScript**
- **Vercel** (Deployment)

---

## Cara Setup

### 1. Clone & Install

```bash
git clone <your-repo>
cd smart-trash-system
npm install
```

---

### 2. Setup Firebase Project

#### A. Buat Project Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com)
2. Klik **"Add project"**
3. Beri nama project (contoh: `smart-trash-system`)
4. Ikuti wizard (Google Analytics opsional)

#### B. Aktifkan Authentication

1. Di sidebar Firebase Console → **Authentication** → **Get started**
2. Tab **Sign-in method** → aktifkan **Email/Password**
3. Klik **Save**

#### C. Buat Firestore Database

1. Sidebar → **Firestore Database** → **Create database**
2. Pilih mode: **Start in production mode**
3. Pilih region terdekat (contoh: `asia-southeast1` untuk Indonesia)
4. Klik **Enable**

#### D. Daftar Web App

1. Project Overview → klik ikon **`</>`** (Web)
2. Daftarkan app, centang **Also set up Firebase Hosting** (opsional)
3. Copy konfigurasi yang muncul:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

---

### 3. Konfigurasi Environment

Buat file `.env.local` di root project:

```bash
cp .env.example .env.local
```

Isi dengan nilai dari Firebase config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

### 4. Firestore Security Rules

Di Firebase Console → **Firestore** → tab **Rules**, paste rules berikut:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /admins/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /codes/{document} {
      allow read: if true;
      allow create, update: if request.auth != null;
    }

    match /pickups/{document} {
      allow create: if true;
      allow read: if request.auth != null;
    }

    match /bins/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Klik **Publish**.

---

### 5. Setup Admin & Data Awal (Script)

#### A. Download Service Account Key

1. Firebase Console → Project Settings → tab **Service accounts**
2. Klik **Generate new private key**
3. Simpan file sebagai `scripts/serviceAccountKey.json`

> ⚠️ **JANGAN commit file ini ke Git!** Sudah ada di `.gitignore`

#### B. Jalankan Script Setup

```bash
npm install firebase-admin
node scripts/firebase-setup.js
```

Script ini akan:
- ✅ Membuat akun admin: `admin@trashsync.com` / `Admin@123456`
- ✅ Menambahkan 3 sample bin

> Ganti password setelah login pertama!

---

### 6. Jalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## Struktur Halaman

| URL | Akses | Keterangan |
|-----|-------|------------|
| `/` | Public | Landing page |
| `/login` | Public | Login admin |
| `/pickup` | Public | Input kode (petugas) |
| `/dashboard` | Admin only | Dashboard + generate kode |
| `/dashboard/bins` | Admin only | Kelola bin sampah |
| `/history` | Admin only | Riwayat pengambilan |

---

## Flow Penggunaan

### Admin:
1. Login di `/login`
2. Tambah bin di `/dashboard/bins`
3. Generate kode unik di `/dashboard`
4. Bagikan kode ke petugas
5. Monitor riwayat di `/history`

### Petugas:
1. Buka `/pickup`
2. Input kode unik
3. Isi nama dan data pengambilan
4. Konfirmasi → data tersimpan otomatis

---

## Deploy ke Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables di Vercel Dashboard
# Project Settings → Environment Variables
# Tambahkan semua variabel dari .env.local
```

---

## Koleksi Firestore

| Koleksi | Isi |
|---------|-----|
| `admins` | Data profil admin |
| `bins` | Data bin sampah |
| `codes` | Kode unik yang digenerate |
| `pickups` | Riwayat pengambilan |

---

## Troubleshooting

**`Firebase: Error (auth/invalid-credential)`**
→ Pastikan Email/Password sudah diaktifkan di Firebase Authentication.

**`Missing or insufficient permissions`**
→ Periksa Firestore Rules sudah di-publish dengan benar.

**Data tidak muncul di dashboard**
→ Pastikan `.env.local` sudah diisi dengan benar dan `npm run dev` direstart.

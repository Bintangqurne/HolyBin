// scripts/firebase-setup.js
// Jalankan sekali untuk setup awal: node scripts/firebase-setup.js
// Pastikan sudah install: npm install firebase-admin

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const path = require("path");
const fs = require("fs");

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("\x1b[31m❌ Error: File 'serviceAccountKey.json' tidak ditemukan!\x1b[0m\n");
  console.error("Untuk menjalankan script ini, Anda memerlukan Firebase Service Account Key.");
  console.error("Silakan ikuti langkah-langkah berikut:");
  console.error("  1. Buka \x1b[36mFirebase Console\x1b[0m (https://console.firebase.google.com)");
  console.error("  2. Masuk ke \x1b[36mProject Settings\x1b[0m (ikon gerigi di samping Project Overview) -> tab \x1b[36mService accounts\x1b[0m");
  console.error("  3. Klik tombol \x1b[32m\"Generate new private key\"\x1b[0m");
  console.error("  4. Simpan file JSON yang diunduh ke lokasi berikut:");
  console.error(`     👉 \x1b[33m${serviceAccountPath}\x1b[0m\n`);
  console.error("Setelah file disimpan, jalankan kembali perintah ini:\n");
  console.error("  \x1b[32mnode scripts/firebase-setup.js\x1b[0m\n");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const auth = getAuth();

async function setup() {
  console.log("🚀 Memulai setup Firebase...\n");

  // 1. Buat admin user
  console.log("1️⃣  Membuat admin user...");
  try {
    const user = await auth.createUser({
      email: "admin@trashsync.com",
      password: "Admin@123456",
      displayName: "Super Admin",
    });

    await db.collection("admins").doc(user.uid).set({
      email: "admin@trashsync.com",
      displayName: "Super Admin",
      role: "superadmin",
      createdAt: new Date(),
    });

    console.log(`   ✅ Admin dibuat: admin@trashsync.com / Admin@123456`);
    console.log(`   UID: ${user.uid}`);
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      console.log("   ℹ️  Admin sudah ada, skip.");
    } else if (err.code === "auth/configuration-not-found") {
      console.error("\n\x1b[31m❌ Error: Firebase Authentication belum diaktifkan atau belum disetup!\x1b[0m");
      console.error("\nSilakan ikuti langkah-langkah berikut untuk mengaktifkannya:");
      console.error("  1. Buka \x1b[36mFirebase Console\x1b[0m (https://console.firebase.google.com)");
      console.error("  2. Di sidebar kiri, klik menu \x1b[36mAuthentication\x1b[0m");
      console.error("  3. Klik tombol \x1b[32m\"Get started\"\x1b[0m (jika baru pertama kali)");
      console.error("  4. Pada tab \x1b[36m\"Sign-in method\"\x1b[0m, pilih \x1b[32m\"Email/Password\"\x1b[0m dan aktifkan (klik Enable lalu Save)");
      console.error("\nSetelah Anda mengaktifkan Email/Password Authentication, silakan jalankan kembali perintah ini.\n");
      process.exit(1);
    } else {
      throw err;
    }
  }

  // 2. Buat sample bins
  console.log("\n2️⃣  Membuat sample bin data...");
  const bins = [
    { location: "Blok A – Taman Kota", address: "Jl. Sudirman No. 1, Jakarta Pusat", capacity: 240 },
    { location: "Blok B – Pasar Modern", address: "Jl. Thamrin No. 5, Jakarta Pusat", capacity: 120 },
    { location: "Blok C – Perumahan Indah", address: "Jl. Kebon Jeruk No. 10, Jakarta Barat", capacity: 180 },
  ];

  for (const bin of bins) {
    await db.collection("bins").add({
      ...bin,
      isActive: true,
      createdAt: new Date(),
    });
    console.log(`   ✅ Bin: ${bin.location}`);
  }

  // 3. Setup Firestore rules info
  console.log("\n3️⃣  Setup selesai! Jangan lupa update Firestore Rules:\n");
  console.log(`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Admin only collections
    match /admins/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /codes/{document} {
      // Siapa saja bisa membaca dan mengupdate status kode (untuk verifikasi & penyelesaian absen)
      allow read, update: if true;
      // Hanya admin terotentikasi yang bisa membuat kode baru
      allow create: if request.auth != null;
    }

    match /pickups/{document} {
      // Anyone can create (officers submitting pickup)
      allow create: if true;
      // Only admins can read
      allow read: if request.auth != null;
    }

    match /bins/{document} {
      // Anyone can read (for officer pickup flow)
      allow read: if true;
      // Only admins can write
      allow write: if request.auth != null;
    }
  }
}
  `);

  console.log("🎉 Setup selesai! Sistem siap digunakan.");
}

setup().catch((err) => {
  if (
    err.code === 7 || 
    (err.message && err.message.includes("Cloud Firestore API")) || 
    (err.details && err.details.includes("Cloud Firestore API"))
  ) {
    console.error("\n\x1b[31m❌ Error: Cloud Firestore Database belum diaktifkan di Firebase Console!\x1b[0m");
    console.error("\nSilakan ikuti langkah-langkah berikut untuk membuat database:");
    console.error("  1. Buka \x1b[36mFirebase Console\x1b[0m (https://console.firebase.google.com)");
    console.error("  2. Di sidebar kiri, klik menu \x1b[36mFirestore Database\x1b[0m");
    console.error("  3. Klik tombol \x1b[32m\"Create database\"\x1b[0m");
    console.error("  4. Pilih lokasi/region terdekat (misal: \x1b[33masia-southeast1\x1b[0m untuk Jakarta/Indonesia) dan klik Next");
    console.error("  5. Mulailah dalam mode apa saja (misal: \x1b[33mStart in production mode\x1b[0m) lalu klik Create");
    console.error("\nSetelah database Firestore selesai dibuat, silakan jalankan kembali perintah ini:\n");
    console.error("  \x1b[32mnode scripts/firebase-setup.js\x1b[0m\n");
    process.exit(1);
  } else {
    console.error(err);
  }
});

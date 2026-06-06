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
  console.error("  2. Masuk ke \x1b[36mProject Settings\x1b[0m -> tab \x1b[36mService accounts\x1b[0m");
  console.error("  3. Klik tombol \x1b[32m\"Generate new private key\"\x1b[0m");
  console.error(`  4. Simpan file JSON ke: \x1b[33m${serviceAccountPath}\x1b[0m\n`);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const auth = getAuth();

// Simple code generators (mirror of lib/generateCode.ts)
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomSegment(len) {
  let s = "";
  for (let i = 0; i < len; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}
const generateBinCode = () => `B-${randomSegment(4)}`;
const generateUserCode = () => `U-${randomSegment(4)}`;

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
      console.error("\n\x1b[31m❌ Error: Firebase Authentication belum diaktifkan!\x1b[0m");
      console.error("Aktifkan Email/Password di Firebase Console > Authentication > Sign-in method\n");
      process.exit(1);
    } else {
      throw err;
    }
  }

  // 2. Buat sample bins (dengan code permanen)
  console.log("\n2️⃣  Membuat sample bin data...");
  const bins = [
    { location: "Blok A – Taman Kota", address: "Jl. Sudirman No. 1, Jakarta Pusat", capacity: 240 },
    { location: "Blok B – Pasar Modern", address: "Jl. Thamrin No. 5, Jakarta Pusat", capacity: 120 },
    { location: "Blok C – Perumahan Indah", address: "Jl. Kebon Jeruk No. 10, Jakarta Barat", capacity: 180 },
  ];

  const createdBins = [];
  for (const bin of bins) {
    const code = generateBinCode();
    const ref = await db.collection("bins").add({
      code,
      ...bin,
      isActive: true,
      createdAt: new Date(),
    });
    createdBins.push({ id: ref.id, code, location: bin.location });
    console.log(`   ✅ Bin: ${bin.location}  →  Kode: \x1b[32m${code}\x1b[0m`);
  }

  // 3. Buat sample officers (petugas dengan QR pribadi)
  console.log("\n3️⃣  Membuat sample petugas (officers)...");
  const officers = [
    { name: "Andi Santoso", phone: "08123456789" },
    { name: "Budi Raharjo", phone: "08987654321" },
  ];

  const createdOfficers = [];
  for (const officer of officers) {
    const userCode = generateUserCode();
    const ref = await db.collection("users").add({
      userCode,
      name: officer.name,
      phone: officer.phone,
      isActive: true,
      createdAt: new Date(),
    });
    createdOfficers.push({ id: ref.id, userCode, name: officer.name });
    console.log(`   ✅ Petugas: ${officer.name}  →  Kode QR: \x1b[33m${userCode}\x1b[0m`);
  }

  // 4. Ringkasan konfigurasi scanner
  console.log("\n4️⃣  Konfigurasi Scanner Python:\n");
  console.log("   Pasang kode berikut di file scanner/.env pada setiap perangkat:\n");
  for (const bin of createdBins) {
    console.log(`   Bin "${bin.location}":`);
    console.log(`   \x1b[36mBIN_CODE=${bin.code}\x1b[0m`);
    console.log(`   API_BASE_URL=https://your-domain.vercel.app`);
    console.log(`   SCANNER_API_TOKEN=change_me_to_a_random_secret\n`);
  }

  // 5. Firestore rules
  console.log("5️⃣  Update Firestore Rules:\n");
  console.log(`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /admins/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /users/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    match /bins/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /attendances/{document} {
      // Scanner POSTs attendance via /api/attendance (server-side, uses Admin SDK — bypasses rules)
      allow read: if request.auth != null;
      allow create: if true;
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
    console.error("\n\x1b[31m❌ Error: Cloud Firestore Database belum diaktifkan!\x1b[0m");
    console.error("Buat database di Firebase Console > Firestore Database > Create database\n");
    process.exit(1);
  } else {
    console.error(err);
  }
});

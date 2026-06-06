// types/user.ts
export type UserRole = "admin" | "superadmin";

// Role petugas lapangan: menentukan kompartemen/servo mana yang dibuka saat scan.
//   pemulung   -> servo 2: kompartemen sampah bisa dipulung (recyclable)
//   kebersihan -> servo 3: kompartemen sampah tidak bisa dipulung
export type OfficerRole = "pemulung" | "kebersihan";

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Date | string;
  lastLogin?: Date | string;
}

export interface Officer {
  id: string;
  userCode: string; // unique, e.g. "U-9M3X" — content of their QR
  name: string;
  phone: string;
  role: OfficerRole; // pemulung | kebersihan — menentukan servo/kompartemen
  isActive: boolean;
  createdAt: Date | string;
}

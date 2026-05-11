// types/user.ts
export type UserRole = "admin" | "superadmin";

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Date | string;
  lastLogin?: Date | string;
}

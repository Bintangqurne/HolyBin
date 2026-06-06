// types/attendance.ts
import { OfficerRole } from "@/types/user";

export interface Attendance {
  id: string;
  userId: string;
  userCode: string;
  userName: string; // denormalized
  userRole?: OfficerRole; // denormalized — pemulung | kebersihan
  binId: string;
  binCode: string;
  binLocation: string; // denormalized
  scannedAt: Date | string;
}

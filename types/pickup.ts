// types/pickup.ts
export type PickupStatus = "pending" | "completed" | "expired";

export interface UniqueCode {
  id: string;
  code: string;
  binId: string;
  binLocation: string;
  generatedAt: Date | string;
  expiresAt: Date | string;
  status: PickupStatus;
  usedBy?: string;
  usedAt?: Date | string;
}

export interface PickupRecord {
  id: string;
  codeId: string;
  code: string;
  binId: string;
  binLocation: string;
  officerName: string;
  officerPhone?: string;
  pickedUpAt: Date | string;
  notes?: string;
  weight?: number; // kg
}

export interface TrashBin {
  id: string;
  location: string;
  address: string;
  capacity: number; // liter
  isActive: boolean;
  createdAt: Date | string;
}

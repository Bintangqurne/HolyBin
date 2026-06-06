// types/pickup.ts
export interface TrashBin {
  id: string;
  code: string; // permanent unique location identifier, e.g. "B-7K2A"
  location: string;
  address: string;
  capacity: number; // liter
  isActive: boolean;
  createdAt: Date | string;
  lastSeenAt?: Date | string; // set by scanner heartbeat
}

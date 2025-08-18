export interface BusinessOpeningHour {
  day: string;
  from: string;
  to: string;
}

export interface AppBusiness {
  companyId?: string;
  ownerUid: string;
  businessName: string;
  address: string;
  phoneNumber: string;
  description?: string;
  openingHours?: BusinessOpeningHour[];
  logoUrl?: string;
  createdAt?: Date;
  appointmentInterval?: number; // מרווח תורים בדקות
}

export interface AppUser {
  companyId?: string;
  uid?: string; // מזהה ייחודי מפיירבייס
  fullName: string; // שם מלא
  email: string; // אימייל
  phoneNumber?: string; // טלפון (לא חובה)
  photoURL?: string; // קישור לתמונה (לא חובה)
  role: 'business' | 'customer'| 'admin'; // תפקיד
  createdAt?: Date; // תאריך הרשמה (לא חובה)
  termsAccepted?: boolean; // אישור תנאי שימוש (לא חובה)
}

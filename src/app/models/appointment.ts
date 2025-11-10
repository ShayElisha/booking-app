export interface Appointment {
  id?: string; // מזהה ייחודי לתור (נוצר על ידי Firestore)
  companyId: string; // מזהה העסק
  serviceId: string; // מזהה השירות
  serviceName: string; // שם השירות (לצורך תצוגה)
  employeeId?: string | null; // מזהה העובד (אופציונלי, אם השירות דורש עובד)
  employeeName?: string; // שם העובד (אופציונלי, לצורך תצוגה)
  customerId: string; // מזהה הלקוח
  customerName?: string; // שם הלקוח (אופציונלי, לצורך תצוגה)
  date: any; // תאריך התור (ISO string, לדוגמה: "2025-06-10")
  time: string; // שעת התור (פורמט HH:mm, לדוגמה: "14:30")
  duration: number; // משך התור בדקות (נגזר מ-service.duration או מרווח תורים)
  createdAt: string; // תאריך ושעה של יצירת התור (ISO string)
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'; // סטטוס התור
  notes?: string; // הערות נוספות (אופציונלי)
  hasReview?: boolean; // האם ניתנה ביקורת לתור זה
}

export interface Service {
  id?: string; // מזהה ייחודי, נוצר אוטומטית על ידי Firestore
  name: string; // שם השירות, מילות מפתח קצרות ומדויקות
  description: string; // תיאור מפורט של השירות, כולל יתרונות ייחודיים
  price: number; // מחיר בסיסי בשקלים, מספר חיובי
  discountPrice?: number; // מחיר מוזל לאחר הנחה, אופציונלי
  companyId: string; // מזהה העסק, קישור ייחודי לבעלים
  category: string; // קטגוריה (למשל: "תספורת", "טיפול", "ייעוץ")
  duration: number; // משך השירות בדקות
  availability: 'available' | 'unavailable' | 'on_request'; // סטטוס זמינות
  tags: string[]; // תגיות לחיפוש מהיר (למשל: ["מהיר", "פרימיום"])
  imageUrl?: string; // כתובת URL לתמונה של השירות, אופציונלי
  createdAt?: string; // תאריך יצירה, בפורמט ISO
  updatedAt?: string; // תאריך עדכון אחרון, בפורמט ISO
  isFeatured: boolean; // האם השירות מומלץ/בולט?
  requiresEmployee?: boolean; // האם השירות דרוש עובד
}

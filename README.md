# 📅 מערכת ניהול תורים - Booking App

מערכת מתקדמת לניהול תורים לעסקים, בנויה עם Angular 16 ו-Firebase.

![Angular](https://img.shields.io/badge/Angular-16.1-red)
![Firebase](https://img.shields.io/badge/Firebase-11.8-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-5.1-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ תכונות

### 👥 לעסקים
- ✅ רישום והתחברות מאובטחים
- ✅ ניהול שירותים עם תמונות
- ✅ ניהול עובדים עם שעות עבודה ייחודיות
- ✅ הגדרת שירותים לכל עובד
- ✅ צפייה ועריכת תורים
- ✅ העלאת לוגו ותמונות ל-Firebase Storage
- ✅ הגדרת שעות פעילות גמישות
- ✅ לוח שנה אינטראקטיבי

### 🛍️ ללקוחות
- ✅ חיפוש עסקים
- ✅ צפייה בשירותים ומחירים
- ✅ קביעת תורים מקוונים
- ✅ בחירת עובד ספציפי
- ✅ ניהול תורים (ביטול, עדכון)
- ✅ הוספת עסקים למועדפים

### 🔐 למנהלי מערכת
- ✅ צפייה בכל העסקים
- ✅ ניהול משתמשים
- ✅ סטטיסטיקות

---

## 🚀 התקנה והרצה

### דרישות מקדימות

```bash
Node.js v16+ (מומלץ v18)
npm v7+
Angular CLI v16+
```

### התקנה

```bash
# שכפול הפרויקט
git clone <repository-url>
cd Booking-app

# התקנת תלויות
npm install

# הגדרת Firebase (ראה הוראות למטה)
```

### הגדרת Firebase

1. **צור פרויקט Firebase**:
   - לך ל: https://console.firebase.google.com/
   - צור פרויקט חדש
   - הפעל Authentication, Firestore, Storage

2. **הגדר את ה-credentials**:
   - העתק את  Firebase config
   - עדכן `src/app/environments/environment.prod.ts`

3. **הגדר Security Rules**:

**Firestore Rules** (`firestore.rules`):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /businesses/{business} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                   request.auth.uid == resource.data.ownerUid;
      
      match /appointments/{appointment} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
        allow update, delete: if request.auth != null;
      }
      
      match /employees/{employee} {
        allow read: if request.auth != null;
        allow write: if request.auth != null;
      }
      
      match /services/{service} {
        allow read: if true;
        allow write: if request.auth != null;
      }
    }
    
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Storage Rules** (`storage.rules`):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // כולם יכולים לקרוא תמונות
    match /{allPaths=**} {
      allow read: if true;
    }
    
    // רק משתמשים מחוברים יכולים להעלות
    match /logos/{userId}/{fileName} {
      allow write: if request.auth != null && 
                   request.auth.uid == userId &&
                   request.resource.size < 5 * 1024 * 1024 &&
                   request.resource.contentType.matches('image/.*');
    }
    
    match /services/{companyId}/{fileName} {
      allow write: if request.auth != null &&
                   request.resource.size < 5 * 1024 * 1024 &&
                   request.resource.contentType.matches('image/.*');
    }
    
    match /employees/{companyId}/{fileName} {
      allow write: if request.auth != null &&
                   request.resource.size < 5 * 1024 * 1024 &&
                   request.resource.contentType.matches('image/.*');
    }
  }
}
```

4. **פרסם את הכללים**:
   - ב-Firebase Console → Firestore → Rules → Publish
   - ב-Firebase Console → Storage → Rules → Publish

### הרצת האפליקציה

```bash
# מצב פיתוח
npm start
# או
npx ng serve

# הדפדפן ייפתח אוטומטית ב-http://localhost:4200
```

### בנייה לייצור

```bash
npm run build

# הקבצים יהיו בתיקיית dist/
```

---

## 📂 מבנה הפרויקט

```
src/app/
├── auth/                    # רכיבי אימות
│   ├── login/              # התחברות
│   └── register/           # הרשמה
├── business/               # רכיבי עסק
│   ├── business-profile/   # פרופיל עסק
│   ├── register-business/  # הרשמת עסק
│   └── appointment-list/   # רשימת תורים
├── customer-profile/       # פרופיל לקוח
├── search/                 # חיפוש עסקים
├── admin-panel/            # פאנל מנהל
├── layout/                 # רכיבי תבנית
│   ├── header/            # כותרת עליונה
│   └── footer/            # כותרת תחתונה
├── models/                 # ממשקי TypeScript
│   ├── app-business.ts
│   ├── app-user.ts
│   ├── appointment.ts
│   ├── employee.ts
│   └── service.ts
├── services/               # שירותי Angular
│   ├── user.service.ts
│   ├── business.service.ts
│   ├── employee.service.ts
│   ├── service.service.ts
│   └── appointment.service.ts
├── shared/                 # קוד משותף
│   ├── constants.ts
│   ├── validators/
│   ├── utils/
│   └── services/
└── pipes/                  # צינורות מותאמים
```

---

## 🔥 Firebase Structure

### Firestore Collections

```
/users/{userId}
  - fullName: string
  - email: string
  - role: 'customer' | 'business' | 'admin'
  - companyId?: string
  - phoneNumber?: string

/businesses/{companyId}
  - businessName: string
  - ownerUid: string
  - address: string
  - phoneNumber: string
  - logoUrl?: string
  - openingHours: Array<{day, from, to}>
  - appointmentInterval: number
  
  /employees/{employeeId}
    - name: string
    - role: string
    - phone: string
    - imageUrl?: string
    - services: string[]
    - openingHours?: Array<{day, from, to, isActive}>
  
  /services/{serviceId}
    - name: string
    - description: string
    - price: number
    - duration: number
    - imageUrl?: string
    - category: string
    - requiresEmployee: boolean
  
  /appointments/{appointmentId}
    - customerId: string
    - customerName: string
    - employeeId?: string
    - employeeName?: string
    - serviceId: string
    - serviceName: string
    - date: string (YYYY-MM-DD)
    - time: string (HH:MM)
    - status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
    - duration: number
    - notes?: string
```

### Firebase Storage Structure

```
/logos/{userId}/{timestamp}_{filename}
/services/{companyId}/{timestamp}_{filename}
/employees/{companyId}/{timestamp}_{filename}
```

---

## 🎯 תהליכי עבודה עיקריים

### הרשמה וכניסה
```
1. משתמש נרשם → Firebase Authentication
2. בחירת תפקיד (customer/business)
3. שמירת מידע ב-Firestore users collection
4. אם business → ניתוב ל-register-business
```

### הרשמת עסק
```
1. מילוי פרטים + העלאת לוגו
2. העלאת לוגו ל-Firebase Storage
3. שמירת business ב-Firestore
4. עדכון user document עם companyId
5. ניתוב לדף business-panel
```

### קביעת תור
```
1. לקוח בוחר עסק → דף business profile
2. בחירת שירות
3. בחירת עובד (אם נדרש)
4. בחירת תאריך מלוח שנה
5. בחירת שעה מזמינות
6. שמירת תור ב-Firestore
```

### חישוב זמנים פנויים
```
1. בדיקת שעות עבודה:
   - אם לעובד יש שעות → שעות העובד
   - אחרת → שעות העסק
2. יצירת רשימת שעות אפשריות
3. סינון שעות תפוסות:
   - אם שירות דורש עובד → רק תורי העובד הספציפי
   - אחרת → כל התורים
4. החזרת שעות פנויות
```

---

## 🛠️ טכנולוגיות

| טכנולוגיה | גרסה | שימוש |
|-----------|------|-------|
| **Angular** | 16.1 | Framework |
| **TypeScript** | 5.1 | שפה |
| **Firebase Auth** | 11.8 | אימות |
| **Firestore** | 11.8 | מסד נתונים |
| **Firebase Storage** | 11.8 | אחסון קבצים |
| **Angular Calendar** | 0.31 | לוח שנה |
| **ngx-toastr** | 19.0 | הודעות |
| **RxJS** | 7.8 | תכנות ריאקטיבי |
| **date-fns** | 4.1 | עיבוד תאריכים |

---

## 📱 תמיכה בדפדפנים

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ⚠️ IE11 לא נתמך

---

## 🔐 אבטחה

### Authentication
- Firebase Authentication עם Email/Password
- Google Sign-In
- תמיכה בהרשאות (Roles): customer, business, admin

### Authorization
- תפקידים מבוססי Firestore
- הגנה על routes
- Firestore Security Rules
- Storage Security Rules

### Best Practices
- ✅ Input validation
- ✅ XSS protection (Angular built-in)
- ✅ CSRF protection
- ✅ Secure file uploads
- ⚠️ **חשוב**: העבר secrets ל-environment variables

---

## 📊 ביצועים

### אופטימיזציות מיושמות
- ✅ OnPush Change Detection
- ✅ Lazy image loading
- ✅ LocalStorage caching
- ✅ RxJS operators optimization

### מדדים
- Initial load: ~8.46 MB (uncompressed)
- Build time: ~25s
- Compilation: < 3s (incremental)

### שיפורים מומלצים
- [ ] Lazy loading modules
- [ ] Image optimization (WebP)
- [ ] Service Workers (PWA)
- [ ] Server-side rendering (SSR)

---

## 🧪 בדיקות

### הרצת בדיקות
```bash
# Unit tests
npm test

# E2E tests
npm run e2e

# Code coverage
npm run test -- --coverage
```

### כיסוי נוכחי
- ⚠️ **TODO**: הוסף unit tests
- ⚠️ **TODO**: הוסף E2E tests

---

## 📖 שימוש

### כלקוח
1. הירשם כ-"לקוח"
2. חפש עסקים בעמוד Search
3. בחר עסק וקבע תור
4. עקוב אחר התורים שלך ב-Customer Profile

### כעסק
1. הירשם כ-"עסק"
2. הירשם בעמוד Register Business
3. הוסף שירותים ועובדים
4. נהל תורים ב-Business Panel
5. צפה בלקוחות והזמנות

### כמנהל
1. הירשם עם `adminKey` (URL parameter)
2. צפה בכל העסקים במערכת
3. נהל משתמשים

---

## 🐛 פתרון בעיות

### בעיות נפוצות

#### 1. "אין הרשאה להעלאת קבצים"
**פתרון**:
- הגדר Firebase Storage Rules (ראה למעלה)
- ודא שהמשתמש מחובר
- בדוק בקונסול Firebase

#### 2. "התמונות לא נטענות"
**פתרון**:
- בדוק Firebase Storage Rules - `allow read: if true`
- בדוק Network tab (F12) לשגיאות 403
- ודא שה-URLs תקינים ב-Firestore

#### 3. "העלאת תמונה תקועה"
**פתרון**:
- בדוק גודל הקובץ (מקסימום 5MB)
- בדוק חיבור אינטרנט
- ראה לוגים בקונסול (F12)

#### 4. "ng: command not found"
**פתרון**:
```bash
npx ng serve
# או התקן גלובלית:
npm install -g @angular/cli
```

#### 5. "Port 4200 is already in use"
**פתרון**:
```bash
# Mac/Linux:
lsof -ti:4200 | xargs kill -9

# Windows:
netstat -ano | findstr :4200
taskkill /PID <PID> /F
```

---

## 🔄 עדכונים אחרונים

### v1.1.0 (נובמבר 2025)
- ✅ שעות עבודה ייחודיות לעובדים
- ✅ הגדרת שירותים לעובד
- ✅ תורים ספציפיים לעובד
- ✅ שיפור העלאת תמונות
- ✅ תיקון לולאות אינסופיות
- ✅ הודעות שגיאה משופרות
- ✅ Loading indicators
- ✅ Constants & Validators משותפים
- ✅ ImageUploadService
- ✅ ErrorHandler utility

### v1.0.0 (אוקטובר 2025)
- 🎉 גרסה ראשונית
- ✅ אימות משתמשים
- ✅ ניהול עסקים
- ✅ קביעת תורים
- ✅ חיפוש עסקים

---

## 🤝 תרומה

תרומות מתקבלות בברכה!

1. Fork את הפרויקט
2. צור branch חדש (`git checkout -b feature/AmazingFeature`)
3. Commit השינויים (`git commit -m 'Add AmazingFeature'`)
4. Push ל-branch (`git push origin feature/AmazingFeature`)
5. פתח Pull Request

---

## 📝 License

MIT License - ראה קובץ LICENSE למידע נוסף

---

## 👨‍💻 יוצר

**Booking App Team**

- 📧 Email: support@bookingapp.com
- 🌐 Website: https://bookingapp.com
- 💬 Support: https://bookingapp.com/support

---

## 🙏 תודות

- [Angular Team](https://angular.io/)
- [Firebase](https://firebase.google.com/)
- [Angular Calendar](https://github.com/mattlewis92/angular-calendar)
- [ngx-toastr](https://github.com/scttcper/ngx-toastr)

---

## 📚 משאבים נוספים

- [תיעוד Angular](https://angular.io/docs)
- [תיעוד Firebase](https://firebase.google.com/docs)
- [Angular Fire](https://github.com/angular/angularfire)
- [RxJS](https://rxjs.dev/)

---

**Built with ❤️ in Israel 🇮🇱**

import { Injectable } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  deleteUser,
  User,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  docData,
} from '@angular/fire/firestore';
import { from, map, Observable } from 'rxjs';
import { AppUser } from '../models/app-user';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  constructor(
    public auth: Auth,
    private firestore: Firestore,
    private router: Router
  ) {}

  // שמירת משתמש (עדכון/יצירה) ב-Firestore
  async saveUserToFirestore(user: AppUser): Promise<void> {
    if (!user.uid) throw new Error('חסר uid');
    const userRef = doc(this.firestore, `users/${user.uid}`);
    try {
      await setDoc(userRef, user, { merge: true });
    } catch (error) {
      throw new Error(
        'שגיאה בשמירת משתמש ל-Firestore: ' + (error as Error).message
      );
    }
  }

  // שמירת משתמש רק אם לא קיים ב-Firestore (ל-Social Login)
  async saveUserToFirestoreIfNotExists(user: AppUser): Promise<void> {
    if (!user.uid) throw new Error('חסר uid');
    const userRef = doc(this.firestore, `users/${user.uid}`);
    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, user);
      }
    } catch (error) {
      throw new Error(
        'שגיאה בבדיקה/שמירה ב-Firestore: ' + (error as Error).message
      );
    }
  }

  // רישום משתמש חדש (כולל שמירה ב-Firestore)
  async register(user: AppUser, password: string): Promise<void> {
    try {
      const cred = await createUserWithEmailAndPassword(
        this.auth,
        user.email,
        password
      );
      await updateProfile(cred.user, {
        displayName: user.fullName,
        photoURL: user.photoURL || '',
      });
      const userRef = doc(this.firestore, `users/${cred.user.uid}`);
      await setDoc(userRef, {
        uid: cred.user.uid,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        photoURL: user.photoURL || '',
        role: user.role,
        createdAt: new Date().toISOString(),
        termsAccepted: user.termsAccepted || false,
      });
    } catch (error) {
      throw new Error('שגיאה ברישום משתמש: ' + (error as Error).message);
    }
  }

  // התחברות
  async login(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      throw new Error('שגיאה בהתחברות: ' + (error as Error).message);
    }
  }

  // התנתקות
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.router.navigate(['/login']);
    } catch (error) {
      throw new Error('שגיאה בהתנתקות: ' + (error as Error).message);
    }
  }

  // קבלת פרטי משתמש נוכחי (מאותנטיקציה)
  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  // קבלת פרטי משתמש מ-Firestore (לפי UID)
getUserProfile(uid: string): Observable<AppUser | null> {
  const userRef = doc(this.firestore, `users/${uid}`);
  return from(getDoc(userRef)).pipe(
    map((docSnap) => (docSnap.exists() ? (docSnap.data() as AppUser) : null))
  );
}
  // עדכון נתוני פרופיל (ב-Firestore וגם בפרופיל האותנטיקציה)
  async updateUser(uid: string, data: Partial<AppUser>): Promise<void> {
    try {
      const userRef = doc(this.firestore, `users/${uid}`);
      await updateDoc(userRef, data);
      if (this.auth.currentUser && (data.fullName || data.photoURL)) {
        await updateProfile(this.auth.currentUser, {
          displayName: data.fullName || this.auth.currentUser.displayName,
          photoURL: data.photoURL || this.auth.currentUser.photoURL,
        });
      }
    } catch (error) {
      throw new Error('שגיאה בעדכון פרופיל: ' + (error as Error).message);
    }
  }

  // מחיקת משתמש (מ-Firestore וגם מ-Auth)
  async deleteUserAccount(): Promise<void> {
    if (!this.auth.currentUser) throw new Error('אין משתמש מחובר');
    const uid = this.auth.currentUser.uid;
    try {
      const userRef = doc(this.firestore, `users/${uid}`);
      await deleteDoc(userRef);
      await deleteUser(this.auth.currentUser);
      this.router.navigate(['/register']);
    } catch (error) {
      throw new Error('שגיאה במחיקת חשבון: ' + (error as Error).message);
    }
  }
}

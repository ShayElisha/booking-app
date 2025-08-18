import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from '@angular/fire/firestore';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AppBusiness } from '../models/app-business';

@Injectable({
  providedIn: 'root',
})
export class BusinessService {
  constructor(private firestore: Firestore) {}

  // Create
  async addBusiness(business: AppBusiness): Promise<any> {
    try {
      const businessesRef = collection(this.firestore, 'businesses');
      const docRef = await addDoc(businessesRef, {
        ...business,
        createdAt: business.createdAt || new Date(),
      });
      return { id: docRef.id, ...business };
    } catch (error) {
      console.error('Error adding business:', error);
      throw new Error('שגיאה בהוספת עסק: ' + (error as Error).message);
    }
  }

  // Read (All)
  getBusinesses(): Observable<AppBusiness[]> {
    const businessesRef = collection(this.firestore, 'businesses');
    return from(getDocs(businessesRef)).pipe(
      map((querySnapshot) =>
        querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as AppBusiness),
        }))
      ),
      catchError((error) => {
        console.error('Error fetching businesses:', error);
        return throwError(
          () => new Error('שגיאה בטעינת עסקים: ' + error.message)
        );
      })
    );
  }

  // Read (By Id)
  getBusinessById(id: string): Observable<AppBusiness | undefined> {
    const businessRef = doc(this.firestore, 'businesses', id);
    return from(getDoc(businessRef)).pipe(
      map((docSnapshot) => {
        if (docSnapshot.exists()) {
          return { id: docSnapshot.id, ...(docSnapshot.data() as AppBusiness) };
        }
        return undefined;
      }),
      catchError((error) => {
        console.error('Error fetching business by ID:', error);
        return throwError(
          () => new Error('שגיאה בטעינת עסק: ' + error.message)
        );
      })
    );
  }

  // Update
  async updateBusiness(id: string, data: Partial<AppBusiness>): Promise<void> {
    try {
      const businessRef = doc(this.firestore, 'businesses', id);
      await updateDoc(businessRef, data);
    } catch (error) {
      console.error('Error updating business:', error);
      throw new Error('שגיאה בעדכון עסק: ' + (error as Error).message);
    }
  }

  // Delete
  async deleteBusiness(id: string): Promise<void> {
    try {
      const businessRef = doc(this.firestore, 'businesses', id);
      await deleteDoc(businessRef);
    } catch (error) {
      console.error('Error deleting business:', error);
      throw new Error('שגיאה במחיקת עסק: ' + (error as Error).message);
    }
  }
}

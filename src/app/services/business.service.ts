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
      map((querySnapshot) => {
        const businesses = querySnapshot.docs.map((doc) => {
          const data = doc.data() as AppBusiness;
          const business = {
            companyId: doc.id, // Make sure companyId is set from document id
            ...data,
          };
          console.log('Business loaded:', business.businessName, 'Logo URL:', business.logoUrl);
          return business;
        });
        console.log('Total businesses loaded:', businesses.length);
        return businesses;
      }),
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

  // Add Review
  async addReview(review: any): Promise<any> {
    try {
      const reviewsRef = collection(
        this.firestore,
        `businesses/${review.companyId}/reviews`
      );
      const docRef = await addDoc(reviewsRef, review);
      console.log('✅ Review added:', docRef.id);
      return { id: docRef.id, ...review };
    } catch (error) {
      console.error('❌ Error adding review:', error);
      throw new Error('שגיאה בהוספת ביקורת: ' + (error as Error).message);
    }
  }
}

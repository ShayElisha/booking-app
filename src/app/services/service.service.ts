import { Injectable } from '@angular/core';
import {
  AngularFirestore,
  AngularFirestoreCollection,
} from '@angular/fire/compat/firestore';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Service } from '../models/service'; // Adjust path to your Service interface

@Injectable({
  providedIn: 'root',
})
export class ServicesService {
  constructor(private firestore: AngularFirestore) {}

  // Create: הוספת שירות חדש וחזרת ה-ID
  async addService(service: Service): Promise<string> {
    try {
      if (!service.companyId) {
        throw new Error('Company ID is required');
      }
      const collectionPath = `businesses/${service.companyId}/services`;
      const servicesCollection =
        this.firestore.collection<Service>(collectionPath);
      const id = this.firestore.createId();
      const newService = {
        ...service,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await servicesCollection.doc(id).set(newService);
      return id; // החזרת ה-ID של השירות שנוצר
    } catch (error) {
      throw new Error(`שגיאה בהוספת שירות: ${error}`);
    }
  }

  // Read: קבלת כל השירותים של עסק
  getServicesByCompanyId(companyId: string): Observable<Service[]> {
    const collectionPath = `businesses/${companyId}/services`;
    return this.firestore
      .collection<Service>(collectionPath)
      .snapshotChanges()
      .pipe(
        map((actions) =>
          actions.map((a) => {
            const data = a.payload.doc.data() as Service;
            const id = a.payload.doc.id;
            return { id, ...data };
          })
        ),
        catchError((error) =>
          throwError(() => new Error(`שגיאה בקבלת שירותים: ${error}`))
        )
      );
  }

  // Read: קבלת שירות לפי ID
  getService(companyId: string, id: string): Observable<Service | undefined> {
    const collectionPath = `businesses/${companyId}/services`;
    return this.firestore
      .collection<Service>(collectionPath)
      .doc<Service>(id)
      .valueChanges()
      .pipe(
        map((data) => (data ? { id, ...data } : undefined)),
        catchError((error) =>
          throwError(() => new Error(`שגיאה בקבלת שירות: ${error}`))
        )
      );
  }

  // Update: עדכון שירות קיים
  async updateService(
    companyId: string,
    id: string,
    service: Partial<Service>
  ): Promise<void> {
    try {
      const collectionPath = `businesses/${companyId}/services`;
      const updatedService = {
        ...service,
        updatedAt: new Date().toISOString(),
      };
      await this.firestore
        .collection(collectionPath)
        .doc(id)
        .update(updatedService);
    } catch (error) {
      throw new Error(`שגיאה בעדכון שירות: ${error}`);
    }
  }

  // Delete: מחיקת שירות
  async deleteService(companyId: string, id: string): Promise<void> {
    try {
      const collectionPath = `businesses/${companyId}/services`;
      await this.firestore.collection(collectionPath).doc(id).delete();
    } catch (error) {
      throw new Error(`שגיאה במחיקת שירות: ${error}`);
    }
  }
}

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
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { Appointment } from '../models/appointment';
import { Timestamp } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class AppointmentService {
  constructor(private firestore: Firestore, private toastr: ToastrService) {}

  // Create: הוספת תור חדש
  async addAppointment(
    companyId: string,
    appointment: Appointment
  ): Promise<any> {
    const appointmentsRef = collection(
      this.firestore,
      `businesses/${companyId}/appointments`
    );
    try {
      // Ensure date is a string before saving
      const appointmentToSave = {
        ...appointment,
        date:
          appointment.date instanceof Date
            ? appointment.date.toISOString().split('T')[0]
            : appointment.date instanceof Timestamp
            ? appointment.date.toDate().toISOString().split('T')[0]
            : appointment.date,
      };
      console.log('Saving appointment:', appointmentToSave);
      const result = await addDoc(appointmentsRef, appointmentToSave);
      this.toastr.success('התור נוסף בהצלחה!', 'הצלחה');
      return result;
    } catch (error) {
      this.toastr.error(
        'שגיאה בהוספת התור: ' + (error as Error).message,
        'שגיאה'
      );
      throw error;
    }
  }

  // Read: קבלת כל התורים של עסק
  getAppointmentsByCompanyId(companyId: string): Observable<Appointment[]> {
    const appointmentsRef = collection(
      this.firestore,
      `businesses/${companyId}/appointments`
    );
    return from(getDocs(appointmentsRef)).pipe(
      map((querySnapshot) =>
        querySnapshot.docs.map((doc) => {
          const data = doc.data() as Appointment;
          // Convert Timestamp to Date
          data.date = this.convertToDate(data.date);
          console.log('Converted appointment date:', data.date);
          return {
            id: doc.id,
            ...data,
          };
        })
      )
    );
  }

  // Read: קבלת תור ספציפי לפי ID
  getAppointmentById(
    companyId: string,
    appointmentId: string
  ): Observable<Appointment | undefined> {
    const appointmentRef = doc(
      this.firestore,
      `businesses/${companyId}/appointments`,
      appointmentId
    );
    return from(getDoc(appointmentRef)).pipe(
      map((docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as Appointment;
          // Convert Timestamp to Date
          data.date = this.convertToDate(data.date);
          console.log('Converted appointment date:', data.date);
          return { id: docSnapshot.id, ...data };
        }
        return undefined;
      })
    );
  }

  // Read: קבלת תורים לפי תאריך ועסק
  getAppointmentsByDate(
    companyId: string,
    date: string
  ): Observable<Appointment[]> {
    const appointmentsRef = collection(
      this.firestore,
      `businesses/${companyId}/appointments`
    );
    const q = query(appointmentsRef, where('date', '==', date));
    return from(getDocs(q)).pipe(
      map((querySnapshot) =>
        querySnapshot.docs.map((doc) => {
          const data = doc.data() as Appointment;
          // Convert Timestamp to Date
          data.date = this.convertToDate(data.date);
          console.log('Converted appointment date:', data.date);
          return {
            id: doc.id,
            ...data,
          };
        })
      )
    );
  }

  // Read: קבלת תורים של לקוח ספציפי בעסק
  getAppointmentsByCustomerId(
    companyId: string,
    customerId: string
  ): Observable<Appointment[]> {
    const appointmentsRef = collection(
      this.firestore,
      `businesses/${companyId}/appointments`
    );
    console.log(
      `Querying appointments for companyId: ${companyId}, customerId: ${customerId}`
    );
    const q = query(appointmentsRef, where('customerId', '==', customerId));
    return from(getDocs(q)).pipe(
      map((querySnapshot) => {
        console.log('Query snapshot size:', querySnapshot.size);
        const appointments = querySnapshot.docs.map((doc) => {
          const data = doc.data() as Appointment;
          data.date = this.convertToDate(data.date);
          console.log('Converted appointment date:', data.date);
          return {
            id: doc.id,
            ...data,
          };
        });
        console.log(
          `Appointments found for ${companyId} and customer ${customerId}:`,
          appointments
        );
        return appointments;
      }),
      catchError((error) => {
        console.error('Error fetching appointments:', error.message);
        return of([]);
      })
    );
  }

  // Update: עדכון תור קיים
  async updateAppointment(
    companyId: string,
    appointmentId: string,
    data: Partial<Appointment>
  ): Promise<void> {
    const appointmentRef = doc(
      this.firestore,
      `businesses/${companyId}/appointments`,
      appointmentId
    );
    try {
      // Convert date to string if it's a Date or Timestamp
      const dataToUpdate = {
        ...data,
        date:
          data.date instanceof Date
            ? data.date.toISOString().split('T')[0]
            : data.date instanceof Timestamp
            ? data.date.toDate().toISOString().split('T')[0]
            : data.date,
      };
      await updateDoc(appointmentRef, dataToUpdate);
      this.toastr.success('התור עודכן בהצלחה!', 'הצלחה');
    } catch (error) {
      this.toastr.error(
        'שגיאה בעדכון התור: ' + (error as Error).message,
        'שגיאה'
      );
      throw error;
    }
  }

  // Delete: מחיקת תור
  async deleteAppointment(
    companyId: string,
    appointmentId: string
  ): Promise<void> {
    const appointmentRef = doc(
      this.firestore,
      `businesses/${companyId}/appointments`,
      appointmentId
    );
    try {
      await deleteDoc(appointmentRef);
      this.toastr.success('התור נמחק בהצלחה!', 'הצלחה');
    } catch (error) {
      this.toastr.error(
        'שגיאה במחיקת התור: ' + (error as Error).message,
        'שגיאה'
      );
      throw error;
    }
  }

  // Helper method to convert date field
  private convertToDate(
    date: Date | string | Timestamp | undefined
  ): Date | string {
    if (date instanceof Timestamp) {
      const convertedDate = date.toDate();
      console.log('Converted Timestamp to Date:', convertedDate);
      return convertedDate;
    } else if (typeof date === 'string') {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        console.error('Invalid date string:', date);
        return date; // Fallback to string if invalid
      }
      return parsedDate;
    }
    return date instanceof Date ? date : date || '';
  }
}

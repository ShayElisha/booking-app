import { Pipe, PipeTransform } from '@angular/core';
import { Appointment } from '../models/appointment';

@Pipe({
  name: 'sortByDate',
})
export class SortByDatePipe implements PipeTransform {
  transform(appointments: Appointment[]): Appointment[] {
    if (!appointments || !Array.isArray(appointments)) {
      return [];
    }

    return appointments.sort((a, b) => {
      // Convert date field to Date object
      const dateAValue =
        typeof a.date === 'object' && 'toDate' in a.date
          ? (a.date as any).toDate() // Firestore Timestamp
          : typeof a.date === 'string'
          ? new Date(a.date) // String date
          : a.date; // Date object
      const dateBValue =
        typeof b.date === 'object' && 'toDate' in b.date
          ? (b.date as any).toDate()
          : typeof b.date === 'string'
          ? new Date(b.date)
          : b.date;

      // Create date-time for comparison
      const dateTimeA = new Date(
        `${dateAValue.toISOString().split('T')[0]}T${a.time}`
      );
      const dateTimeB = new Date(
        `${dateBValue.toISOString().split('T')[0]}T${b.time}`
      );

      return dateTimeA.getTime() - dateTimeB.getTime();
    });
  }
}

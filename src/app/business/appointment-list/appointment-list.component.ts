import { Component, OnInit } from '@angular/core';
import { AppointmentService } from '../../services/appointment.service';
import { Appointment } from '../../models/appointment';
import { Observable, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { AppUser } from '../../models/app-user';

interface TimeSlot {
  time: string;
  appointments: Appointment[];
}

interface DailySchedule {
  date: string;
  slots: TimeSlot[];
}

@Component({
  selector: 'app-appointment-list',
  templateUrl: './appointment-list.component.html',
  styleUrls: ['./appointment-list.component.scss'],
})
export class AppointmentListComponent implements OnInit {
  schedules$!: Observable<DailySchedule[]>;
  companyId: string | null = null;
  today: Date = new Date(); // Add current date

  private readonly hours = {
    open: '08:00',
    close: '20:00',
  };
  private readonly slotInterval = 30;

  constructor(
    private appointmentService: AppointmentService,
    private auth: Auth,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    onAuthStateChanged(this.auth, (user: User | null) => {
      if (user) {
        console.log('User UID:', user.uid);
        this.loadUserCompanyId(user.uid);
      } else {
        console.log('No user logged in');
        this.schedules$ = of([]);
      }
    });
  }

  private async loadUserCompanyId(uid: string): Promise<void> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const appUser = userDoc.data() as AppUser;
      this.companyId = appUser.companyId || null;
      console.log('Company ID:', this.companyId);
      if (!this.companyId) {
        console.log('No companyId found in user document');
      }
      this.loadAppointments();
    } else {
      console.log('User document not found');
      this.schedules$ = of([]);
    }
  }

  private loadAppointments(): void {
    if (this.companyId) {
      this.schedules$ = this.appointmentService
        .getAppointmentsByCompanyId(this.companyId)
        .pipe(
          map((appointments) => this.createSchedules(appointments)),
          tap((schedules) => console.log('Schedules:', schedules)),
          catchError((err) => {
            console.error('Error fetching appointments:', err);
            return of([]);
          })
        );
    } else {
      console.log('No company ID');
      this.schedules$ = of([]);
    }
  }

  private createSchedules(appointments: Appointment[]): DailySchedule[] {
    const grouped = appointments.reduce((acc, appt) => {
      const date = appt.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(appt);
      return acc;
    }, {} as { [date: string]: Appointment[] });

    return Object.keys(grouped)
      .sort()
      .map((date) => ({
        date,
        slots: this.generateTimeSlots(grouped[date]),
      }));
  }

  private generateTimeSlots(appointments: Appointment[]): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const openMinutes = this.timeToMinutes(this.hours.open);
    const closeMinutes = this.timeToMinutes(this.hours.close);

    for (
      let minutes = openMinutes;
      minutes < closeMinutes;
      minutes += this.slotInterval
    ) {
      const time = this.minutesToTime(minutes);
      const slotAppointments = appointments
        .filter((appt) => this.timeToMinutes(appt.time) === minutes)
        .sort((a, b) => a.time.localeCompare(b.time));
      slots.push({ time, appointments: slotAppointments });
    }

    return slots;
  }

  timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60)
      .toString()
      .padStart(2, '0');
    const mins = (minutes % 60).toString().padStart(2, '0');
    return `${hours}:${mins}`;
  }

  getTimePosition(time: string): number {
    return this.timeToMinutes(time) - this.timeToMinutes(this.hours.open);
  }

  getEndTime(time: string, duration: number): string {
    const startMinutes = this.timeToMinutes(time);
    return this.minutesToTime(startMinutes + duration);
  }

  getTotalAppointments(schedule: DailySchedule): number {
    return schedule.slots.reduce((total, slot) => total + slot.appointments.length, 0);
  }

  getAllAppointmentsCount(schedules: DailySchedule[]): number {
    return schedules.reduce((total, schedule) => total + this.getTotalAppointments(schedule), 0);
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'ממתין',
      'confirmed': 'אושר',
      'completed': 'הושלם',
      'cancelled': 'בוטל',
      'no-show': 'לא הגיע'
    };
    return statusMap[status] || status;
  }

  confirmAppointment(appointment: Appointment): void {
    console.log('🔘 confirmAppointment called');
    console.log('📋 Appointment:', appointment);
    console.log('🏢 Company ID:', this.companyId);
    console.log('🆔 Appointment ID:', appointment.id);
    
    if (!this.companyId || !appointment.id) {
      console.error('❌ Missing company ID or appointment ID');
      alert('שגיאה: חסר מזהה עסק או תור');
      return;
    }

    const confirmed = confirm(`אשר תור עבור ${appointment.customerName || 'לקוח'}?`);
    if (!confirmed) {
      console.log('⚠️ User cancelled the confirmation');
      return;
    }

    console.log('📤 Updating appointment status to confirmed...');
    
    this.appointmentService.updateAppointmentStatus(
      this.companyId,
      appointment.id,
      'confirmed'
    ).then(() => {
      console.log('✅ Appointment confirmed successfully:', appointment.id);
      // רענון הנתונים
      this.loadAppointments();
    }).catch((error) => {
      console.error('❌ Error confirming appointment:', error);
      alert('שגיאה באישור התור: ' + (error as Error).message);
    });
  }

  cancelAppointment(appointment: Appointment): void {
    console.log('🔘 cancelAppointment called');
    console.log('📋 Appointment:', appointment);
    console.log('🏢 Company ID:', this.companyId);
    console.log('🆔 Appointment ID:', appointment.id);
    
    if (!this.companyId || !appointment.id) {
      console.error('❌ Missing company ID or appointment ID');
      alert('שגיאה: חסר מזהה עסק או תור');
      return;
    }

    const confirmed = confirm(`בטל תור עבור ${appointment.customerName || 'לקוח'}?`);
    if (!confirmed) {
      console.log('⚠️ User cancelled the cancellation');
      return;
    }

    console.log('📤 Updating appointment status to cancelled...');
    
    this.appointmentService.updateAppointmentStatus(
      this.companyId,
      appointment.id,
      'cancelled'
    ).then(() => {
      console.log('✅ Appointment cancelled successfully:', appointment.id);
      // רענון הנתונים
      this.loadAppointments();
    }).catch((error) => {
      console.error('❌ Error cancelling appointment:', error);
      alert('שגיאה בביטול התור: ' + (error as Error).message);
    });
  }

  completeAppointment(appointment: Appointment): void {
    console.log('🔘 completeAppointment called');
    console.log('📋 Appointment:', appointment);
    console.log('🏢 Company ID:', this.companyId);
    console.log('🆔 Appointment ID:', appointment.id);
    
    if (!this.companyId || !appointment.id) {
      console.error('❌ Missing company ID or appointment ID');
      alert('שגיאה: חסר מזהה עסק או תור');
      return;
    }

    const confirmed = confirm(`סמן תור כהושלם עבור ${appointment.customerName || 'לקוח'}?`);
    if (!confirmed) {
      console.log('⚠️ User cancelled the completion');
      return;
    }

    console.log('📤 Updating appointment status to completed...');
    
    this.appointmentService.updateAppointmentStatus(
      this.companyId,
      appointment.id,
      'completed'
    ).then(() => {
      console.log('✅ Appointment completed successfully:', appointment.id);
      // רענון הנתונים
      this.loadAppointments();
    }).catch((error) => {
      console.error('❌ Error completing appointment:', error);
      alert('שגיאה בסימון התור כהושלם: ' + (error as Error).message);
    });
  }
}

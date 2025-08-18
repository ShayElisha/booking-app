import { Component, OnInit } from '@angular/core';
import { AppointmentService } from '../services/appointment.service';
import { BusinessService } from '../services/business.service';
import { UserService } from '../services/user.service';
import { Appointment } from '../models/appointment';
import { AppBusiness } from '../models/app-business';
import { AppUser } from '../models/app-user';
import { Router } from '@angular/router';
import { onAuthStateChanged, User } from '@angular/fire/auth';

interface BusinessUsage {
  business: AppBusiness;
  appointmentCount: number;
}

interface AppointmentWithBusiness extends Appointment {
  businessName: string;
}

@Component({
  selector: 'app-customer-profile',
  templateUrl: './customer-profile.component.html',
  styleUrls: ['./customer-profile.component.scss'],
})
export class CustomerProfileComponent implements OnInit {
  appointments: AppointmentWithBusiness[] = [];
  favoriteBusinesses: BusinessUsage[] = [];
  customerId: string | null = null;
  userData: AppUser | null = null;
  greeting: string = '';
  isLoadingUser: boolean = true;
  userError: string | null = null;

  constructor(
    private appointmentService: AppointmentService,
    private businessService: BusinessService,
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.setGreeting();
    onAuthStateChanged(this.userService.auth, (firebaseUser: User | null) => {
      console.log('onAuthStateChanged fired:', firebaseUser);
      this.isLoadingUser = false;
      if (firebaseUser) {
        this.customerId = firebaseUser.uid;
        console.log('Authenticated user ID:', this.customerId);
        this.loadUserData(this.customerId);
        this.loadAppointmentsAndFavorites(this.customerId);
      } else {
        console.log('No authenticated user');
        this.customerId = null;
        this.userData = null;
        this.appointments = [];
        this.favoriteBusinesses = [];
        this.userError = 'אין משתמש מחובר. אנא התחבר מחדש.';
        this.isLoadingUser = false;
      }
    });

    setTimeout(() => {
      if (this.isLoadingUser) {
        console.error('User data load timeout');
        this.isLoadingUser = false;
        this.userError = 'פג זמן טעינת נתוני משתמש. נסה שוב מאוחר יותר.';
      }
    }, 10000);
  }

  setGreeting(): void {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      this.greeting = 'בוקר טוב';
    } else if (hour >= 12 && hour < 17) {
      this.greeting = 'צהריים טובים';
    } else if (hour >= 17 && hour < 22) {
      this.greeting = 'ערב טוב';
    } else {
      this.greeting = 'לילה טוב';
    }
    console.log('Greeting set:', this.greeting);
  }

  loadUserData(customerId: string): void {
    console.log('Loading user data for ID:', customerId);
    this.userService.getUserProfile(customerId).subscribe({
      next: (user) => {
        this.userData = user;
        this.isLoadingUser = false;
        this.userError = null;
        console.log('User data loaded:', user);
      },
      error: (err) => {
        this.isLoadingUser = false;
        this.userError = 'שגיאה בטעינת פרטי משתמש: ' + err.message;
      },
      complete: () => {
        console.log('User data subscription completed');
      },
    });
  }
  loadAppointmentsAndFavorites(customerId: string): void {
    this.businessService.getBusinesses().subscribe({
      next: (businesses) => {
        console.log('Businesses fetched:', businesses);
        const validBusinesses = businesses
          .filter(
            (b): b is AppBusiness & { companyId: string } =>
              b.companyId != null && b.companyId.trim() !== ''
          )
          .map((b) => ({ ...b, companyId: b.companyId! }));

        const businessUsageMap = new Map<string, BusinessUsage>();
        const businessMap = new Map<string, AppBusiness>();
        validBusinesses.forEach((business) => {
          businessUsageMap.set(business.companyId, {
            business,
            appointmentCount: 0,
          });
          businessMap.set(business.companyId, business);
        });

        validBusinesses.forEach((business) => {
          console.log(
            `Checking appointments for business: ${business.companyId}`
          );
          this.appointmentService
            .getAppointmentsByCustomerId(business.companyId, customerId)
            .subscribe({
              next: (appointments) => {
                const pendingAppointments: AppointmentWithBusiness[] =
                  appointments
                    .filter((appointment) => {
                      // Convert date to Date object
                      const appointmentDate =
                        typeof appointment.date === 'object' &&
                        'toDate' in appointment.date
                          ? (appointment.date as any).toDate()
                          : typeof appointment.date === 'string'
                          ? new Date(appointment.date)
                          : appointment.date;
                      const appointmentDateTime = new Date(
                        `${appointmentDate.toISOString().split('T')[0]}T${
                          appointment.time
                        }`
                      );
                      console.log(
                        'Appointment date-time:',
                        appointmentDateTime,
                        'Status:',
                        appointment.status
                      );
                      return (
                        appointmentDateTime > new Date() && // זמני: ניתן להסיר לבדיקה
                        appointment.status === 'pending'
                      );
                    })
                    .map((appointment) => ({
                      ...appointment,
                      date:
                        typeof appointment.date === 'object' &&
                        'toDate' in appointment.date
                          ? (appointment.date as any).toDate()
                          : typeof appointment.date === 'string'
                          ? new Date(appointment.date)
                          : appointment.date,
                      businessName: business.businessName,
                    }));
                this.appointments = [
                  ...this.appointments,
                  ...pendingAppointments,
                ];

                const usage = businessUsageMap.get(business.companyId);
                if (usage) {
                  usage.appointmentCount += appointments.length;
                  businessUsageMap.set(business.companyId, usage);
                }

                this.favoriteBusinesses = Array.from(businessUsageMap.values())
                  .filter((usage) => usage.appointmentCount > 0)
                  .sort((a, b) => b.appointmentCount - a.appointmentCount)
                  .slice(0, 5);

                console.log('Appointments loaded:', this.appointments);
                console.log('Favorite businesses:', this.favoriteBusinesses);
              },
              error: (err) => console.error('Error loading appointments:', err),
            });
        });
      },
      error: (err) => console.error('Error loading businesses:', err),
    });
  }

  async deleteAppointment(appointment: AppointmentWithBusiness): Promise<void> {
    if (!appointment.id || !appointment.companyId) {
      console.error('Missing appointment ID or company ID');
      return;
    }
    try {
      await this.appointmentService.deleteAppointment(
        appointment.companyId,
        appointment.id
      );
      this.appointments = this.appointments.filter(
        (app) => app.id !== appointment.id
      );
      console.log('Appointment deleted:', appointment.id);
    } catch (error) {
      console.error('Error deleting appointment:', error);
    }
  }
}

import { Component, OnInit } from '@angular/core';
import { AppointmentService } from '../services/appointment.service';
import { BusinessService } from '../services/business.service';
import { UserService } from '../services/user.service';
import { Appointment } from '../models/appointment';
import { AppBusiness } from '../models/app-business';
import { AppUser } from '../models/app-user';
import { Router } from '@angular/router';
import { onAuthStateChanged, User } from '@angular/fire/auth';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { ToastrService } from 'ngx-toastr';

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
  
  // Review modal
  showReviewModal = false;
  selectedAppointment: AppointmentWithBusiness | null = null;
  reviewRating = 0;
  reviewComment = '';

  // Edit profile modal
  showEditProfileModal = false;
  profileImagePreview: string | null = null;
  selectedProfileFile: File | null = null;
  editProfileForm = {
    fullName: '',
    phoneNumber: ''
  };

  constructor(
    private appointmentService: AppointmentService,
    private businessService: BusinessService,
    private userService: UserService,
    private router: Router,
    private storage: Storage,
    private toastr: ToastrService
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
    console.log('🔍 Starting to load appointments for customer:', customerId);
    
    // איפוס רשימת התורים
    this.appointments = [];
    
    this.businessService.getBusinesses().subscribe({
      next: (businesses) => {
        console.log('✅ Total businesses fetched:', businesses.length);
        
        const validBusinesses = businesses
          .filter(
            (b): b is AppBusiness & { companyId: string } =>
              b.companyId != null && b.companyId.trim() !== ''
          )
          .map((b) => ({ ...b, companyId: b.companyId! }));

        console.log('✅ Valid businesses (with companyId):', validBusinesses.length);

        const businessUsageMap = new Map<string, BusinessUsage>();
        const businessMap = new Map<string, AppBusiness>();
        validBusinesses.forEach((business) => {
          businessUsageMap.set(business.companyId, {
            business,
            appointmentCount: 0,
          });
          businessMap.set(business.companyId, business);
        });

        let processedBusinesses = 0;
        
        validBusinesses.forEach((business) => {
          console.log(`🏢 Checking appointments for business: ${business.businessName} (ID: ${business.companyId})`);
          
          this.appointmentService
            .getAppointmentsByCustomerId(business.companyId, customerId)
            .subscribe({
              next: (appointments) => {
                processedBusinesses++;
                console.log(`📅 Found ${appointments.length} appointments in ${business.businessName}`);
                console.log('   Appointments:', appointments);
                
                const allAppointments: AppointmentWithBusiness[] =
                  appointments
                    .map((appointment) => {
                      // Convert date to Date object
                      const appointmentDate =
                        typeof appointment.date === 'object' &&
                        'toDate' in appointment.date
                          ? (appointment.date as any).toDate()
                          : typeof appointment.date === 'string'
                          ? new Date(appointment.date)
                          : appointment.date;
                      
                      console.log(`   📌 Appointment: ${appointment.serviceName}`);
                      console.log(`      Date: ${appointmentDate}`);
                      console.log(`      Time: ${appointment.time}`);
                      console.log(`      Status: ${appointment.status}`);
                      
                      return {
                        ...appointment,
                        date: appointmentDate,
                        businessName: business.businessName,
                      };
                    })
                    .sort((a, b) => {
                      // Sort by date (newest first)
                      const dateA = new Date(a.date);
                      const dateB = new Date(b.date);
                      return dateB.getTime() - dateA.getTime();
                    });
                
                console.log(`   ✅ Total appointments: ${allAppointments.length}`);
                
                this.appointments = [
                  ...this.appointments,
                  ...allAppointments,
                ];
                
                // הדפסת סטטוסים לבדיקה
                this.appointments.forEach(app => {
                  console.log(`📌 Appointment: ${app.serviceName} | Status: ${app.status} | HasReview: ${app.hasReview || false}`);
                });

                const usage = businessUsageMap.get(business.companyId);
                if (usage) {
                  usage.appointmentCount += appointments.length;
                  businessUsageMap.set(business.companyId, usage);
                }

                this.favoriteBusinesses = Array.from(businessUsageMap.values())
                  .filter((usage) => usage.appointmentCount > 0)
                  .sort((a, b) => b.appointmentCount - a.appointmentCount)
                  .slice(0, 5);

                console.log(`📊 Progress: ${processedBusinesses}/${validBusinesses.length} businesses processed`);
                console.log(`📋 Total appointments so far: ${this.appointments.length}`);
                console.log(`⭐ Favorite businesses: ${this.favoriteBusinesses.length}`);
              },
              error: (err) => {
                processedBusinesses++;
                console.error(`❌ Error loading appointments for ${business.businessName}:`, err);
              },
            });
        });
      },
      error: (err) => console.error('❌ Error loading businesses:', err),
    });
  }

  isPastAppointment(appointment: AppointmentWithBusiness): boolean {
    const appointmentDateTime = new Date(
      `${new Date(appointment.date).toISOString().split('T')[0]}T${appointment.time}`
    );
    return appointmentDateTime < new Date();
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

  async deleteAppointment(appointment: AppointmentWithBusiness): Promise<void> {
    if (!appointment.id || !appointment.companyId) {
      console.error('Missing appointment ID or company ID');
      return;
    }
    
    const confirmDelete = confirm('האם אתה בטוח שברצונך לבטל את התור?');
    if (!confirmDelete) {
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
      alert('התור בוטל בהצלחה');
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('שגיאה בביטול התור');
    }
  }

  getPendingCount(): number {
    return this.appointments.filter(app => app.status === 'pending').length;
  }

  getConfirmedAndCompletedCount(): number {
    return this.appointments.filter(app => 
      app.status === 'confirmed' || app.status === 'completed'
    ).length;
  }

  getCompletedCount(): number {
    return this.appointments.filter(app => app.status === 'completed').length;
  }

  getCancelledCount(): number {
    return this.appointments.filter(app => app.status === 'cancelled').length;
  }

  openReviewModal(appointment: AppointmentWithBusiness): void {
    this.selectedAppointment = appointment;
    this.reviewRating = 0;
    this.reviewComment = '';
    this.showReviewModal = true;
    document.body.classList.add('modal-open');
  }

  closeReviewModal(): void {
    this.showReviewModal = false;
    this.selectedAppointment = null;
    this.reviewRating = 0;
    this.reviewComment = '';
    document.body.classList.remove('modal-open');
  }

  async submitReview(): Promise<void> {
    if (!this.selectedAppointment || !this.reviewRating || !this.reviewComment || !this.userData) {
      alert('נא למלא את כל השדות');
      return;
    }

    const review = {
      companyId: this.selectedAppointment.companyId,
      customerId: this.customerId,
      customer: this.userData.fullName,
      appointmentId: this.selectedAppointment.id,
      serviceName: this.selectedAppointment.serviceName,
      rating: this.reviewRating,
      comment: this.reviewComment,
      createdAt: new Date().toISOString()
    };

    try {
      // שמירה ב-Firestore
      await this.businessService.addReview(review);
      
      // עדכון התור שניתנה ביקורת
      if (this.selectedAppointment.id && this.selectedAppointment.companyId) {
        await this.appointmentService.updateAppointment(
          this.selectedAppointment.companyId,
          this.selectedAppointment.id,
          { hasReview: true }
        );
        
        // עדכון מקומי של רשימת התורים
        const appointmentIndex = this.appointments.findIndex(
          app => app.id === this.selectedAppointment?.id
        );
        if (appointmentIndex !== -1) {
          this.appointments[appointmentIndex].hasReview = true;
        }
      }
      
      alert('הביקורת נשלחה בהצלחה! תודה על המשוב');
      this.closeReviewModal();
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('שגיאה בשליחת הביקורת');
    }
  }

  // ===============================
  // Edit Profile Functions
  // ===============================

  openEditProfileModal(): void {
    if (!this.userData) {
      this.toastr.error('אין נתוני משתמש');
      return;
    }

    this.editProfileForm = {
      fullName: this.userData.fullName || '',
      phoneNumber: this.userData.phoneNumber || ''
    };

    this.profileImagePreview = this.userData.photoURL || null;
    this.selectedProfileFile = null;
    this.showEditProfileModal = true;
    document.body.classList.add('modal-open');
  }

  closeEditProfileModal(): void {
    this.showEditProfileModal = false;
    this.profileImagePreview = null;
    this.selectedProfileFile = null;
    document.body.classList.remove('modal-open');
  }

  onProfileImageSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedProfileFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profileImagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  async uploadProfileImage(): Promise<string | null> {
    if (!this.selectedProfileFile || !this.customerId) return null;

    try {
      const timestamp = Date.now();
      const fileName = `profile_${this.customerId}_${timestamp}.jpg`;
      const storageRef = ref(this.storage, `users/profiles/${fileName}`);
      await uploadBytes(storageRef, this.selectedProfileFile);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading profile image:', error);
      this.toastr.error('שגיאה בהעלאת תמונה');
      return null;
    }
  }

  async saveProfileDetails(): Promise<void> {
    if (!this.customerId) {
      this.toastr.error('שגיאה: חסר מזהה משתמש');
      return;
    }

    if (!this.editProfileForm.fullName) {
      this.toastr.error('אנא מלא את השם המלא');
      return;
    }

    try {
      const updateData: Partial<AppUser> = {
        fullName: this.editProfileForm.fullName,
        phoneNumber: this.editProfileForm.phoneNumber
      };

      // Upload new profile image if selected
      if (this.selectedProfileFile) {
        const photoURL = await this.uploadProfileImage();
        if (photoURL) {
          updateData.photoURL = photoURL;
        }
      }

      await this.userService.updateUser(this.customerId, updateData);

      // Update local data
      if (this.userData) {
        this.userData = { ...this.userData, ...updateData };
      }

      this.toastr.success('הפרופיל עודכן בהצלחה!');
      this.closeEditProfileModal();
    } catch (err) {
      console.error('Error updating profile:', err);
      this.toastr.error('שגיאה בעדכון הפרופיל: ' + (err as Error).message);
    }
  }
}

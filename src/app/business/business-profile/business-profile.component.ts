import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { ToastrService } from 'ngx-toastr';
import { ServicesService } from '../../services/service.service';
import { EmployeeService } from '../../services/employee.service';
import { AppointmentService } from '../../services/appointment.service';
import { EmployeeAbsenceService } from '../../services/employee-absence.service';
import { Service } from '../../models/service';
import { Employee } from '../../models/employee';
import { Appointment } from '../../models/appointment';
import { EmployeeAbsence } from '../../models/employee-absence';
import { AppBusiness, BusinessOpeningHour } from '../../models/app-business';
import { firstValueFrom } from 'rxjs';
import {
  CalendarEvent,
  CalendarMonthViewBeforeRenderEvent,
} from 'angular-calendar';
import * as dateFns from 'date-fns';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

interface Review {
  id: string;
  customer: string;
  rating: number;
  comment: string;
}

@Component({
  selector: 'app-business-profile',
  templateUrl: './business-profile.component.html',
  styleUrls: ['./business-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessProfileComponent implements OnInit, OnDestroy {
  businessName = '';
  logoUrl = '';
  companyId: string | null = null;
  business: AppBusiness | null = null;
  currentTime = new Date();
  private timeSubscription!: Subscription;
  userRole: 'owner' | 'customer' | null = null;
  fallbackImage = 'https://via.placeholder.com/150';

  employees: Employee[] = [];
  services: Service[] = [];
  reviews: Review[] = [];
  absences: EmployeeAbsence[] = [];
  availableTimes: string[] = [];
  loading = false;
  error = '';
  isOwner = false;
  showServiceModal = false;
  showBookingModal = false;
  showEmployeeModal = false;
  showDescriptionModal = false;
  showAbsenceModal = false;
  bookingStep = 1;
  selectedDate: Date | null = null;
  selectedTime: string | null = null;
  bookingNotes: string = '';
  serviceFormStep = 1;
  editingServiceId: string | null = null;
  editingEmployeeId: string | null = null;
  businessDescription: string = '';

  newService: Service = {
    name: '',
    description: '',
    price: 0,
    companyId: '',
    category: '',
    duration: 0,
    availability: 'available',
    tags: [],
    isFeatured: false,
    requiresEmployee: false,
  };
  newEmployee: Employee = {
    id: '',
    name: '',
    role: '',
    phone: '',
    companyId: '',
    services: [],
  };
  newAbsence: EmployeeAbsence = {
    employeeId: '',
    employeeName: '',
    companyId: '',
    startDate: '',
    endDate: '',
    type: 'vacation',
    status: 'pending',
    reason: '',
    notes: '',
    createdAt: '',
  };
  tagsInput = '';
  selectedService: Service | null = null;
  selectedEmployee: Employee | null = null;
  today = new Date(new Date().setHours(0, 0, 0, 0));

  // Image upload properties
  serviceImagePreview: string | null = null;
  selectedServiceFile: File | null = null;
  employeeImagePreview: string | null = null;
  selectedEmployeeFile: File | null = null;

  // Employee hours properties
  weekDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  employeeHours: { [key: string]: { from: string; to: string } } = {
    'ראשון': { from: '', to: '' },
    'שני': { from: '', to: '' },
    'שלישי': { from: '', to: '' },
    'רביעי': { from: '', to: '' },
    'חמישי': { from: '', to: '' },
    'שישי': { from: '', to: '' },
    'שבת': { from: '', to: '' },
  };

  // Calendar properties
  viewDate: Date = new Date();
  events: CalendarEvent[] = [];
  locale: string = 'he';

  constructor(
    private route: ActivatedRoute,
    private auth: Auth,
    private firestore: Firestore,
    private storage: Storage,
    private toastr: ToastrService,
    private servicesService: ServicesService,
    private employeeService: EmployeeService,
    private appointmentService: AppointmentService,
    private absenceService: EmployeeAbsenceService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.loading = true;
    this.cdr.markForCheck();

    onAuthStateChanged(this.auth, async (user: User | null) => {
      try {
        console.log('Auth state changed, user:', user?.uid);
        this.companyId = this.route.snapshot.paramMap.get('id');
        if (!this.companyId && user) {
          const userRef = doc(this.firestore, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            this.userRole =
              userData['role'] === 'business'
                ? 'owner'
                : userData['role'] || 'customer';
            if (this.userRole === 'owner') {
              this.companyId = userData['companyId'] || null;
              if (!this.companyId) {
                this.error = 'לא נמצא מזהה חברה עבור בעל העסק.';
                this.toastr.error(this.error);
                this.loading = false;
                this.cdr.markForCheck();
                return;
              }
            } else {
              this.error = 'משתמש זה אינו בעל עסק ואין מזהה חברה ב-URL.';
              this.toastr.error(this.error);
              this.loading = false;
              this.cdr.markForCheck();
              return;
            }
          } else {
            this.userRole = 'customer';
            this.error = 'מסמך משתמש לא נמצא ואין מזהה חברה ב-URL.';
            this.toastr.error(this.error);
            this.loading = false;
            this.cdr.markForCheck();
            return;
          }
        } else if (user && this.companyId) {
          const userRef = doc(this.firestore, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            this.userRole =
              userData['role'] === 'business'
                ? 'owner'
                : userData['role'] || 'customer';
          }
        } else if (!user && !this.companyId) {
          this.userRole = null;
          this.error = 'לא נמצא מזהה חברה ב-URL ואין משתמש מחובר.';
          this.toastr.error(this.error);
          this.loading = false;
          this.cdr.markForCheck();
          return;
        } else {
          this.userRole = 'customer';
        }

        console.log('📍 Loading business data for companyId:', this.companyId);
        console.log('👤 User UID:', user?.uid);
        console.log('🎭 User role:', this.userRole);
        
        await this.loadBusinessData(user?.uid, this.companyId!);
        if (!this.error) {
          this.isOwner = this.userRole === 'owner';
          await Promise.all([
            this.loadEmployees(this.companyId!),
            this.loadServices(this.companyId!),
            this.loadReviews(this.companyId!),
            this.loadAbsences(this.companyId!),
          ]);
        }
      } catch (err) {
        console.error('Error in auth state change:', err);
        this.error = 'שגיאה בעת טעינת נתוני עסק.';
        this.toastr.error(this.error);
      } finally {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });

    this.timeSubscription = interval(1000).subscribe(() => {
      this.currentTime = new Date();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    if (this.timeSubscription) {
      this.timeSubscription.unsubscribe();
    }
  }

  sanitizeUrl(url: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  async loadBusinessData(uid: string | undefined, companyId: string) {
    try {
      console.log('🔄 loadBusinessData called');
      console.log('   UID:', uid);
      console.log('   CompanyId:', companyId);
      
      // Skip cache - always load fresh from Firestore
      const businessRef = doc(this.firestore, 'businesses', companyId);
      const businessSnap = await getDoc(businessRef);

      if (businessSnap.exists()) {
        const business = businessSnap.data() as AppBusiness;
        console.log('📊 Business data:', business);
        console.log('🖼️ Logo URL from database:', business.logoUrl);
        
        this.businessName = business.businessName || 'ללא שם עסק';
        this.logoUrl = business.logoUrl || '';
        this.isOwner = uid ? business.ownerUid === uid : false;
        this.business = business;
        
        console.log('✅ Set logoUrl to:', this.logoUrl);
        console.log('✅ Is owner:', this.isOwner);
        
        // Force change detection
        this.cdr.detectChanges();
      } else {
        this.error = 'העסק לא נמצא.';
        this.toastr.error(this.error);
      }
    } catch (err) {
      console.error('Error loading business data:', err);
      this.error = 'שגיאה בטעינת פרטי העסק.';
      this.toastr.error(this.error);
      this.logoUrl = '';
    } finally {
      this.cdr.markForCheck();
    }
  }

  async loadEmployees(companyId: string) {
    try {
      console.log(`Loading employees for companyId: ${companyId}`);
      this.employeeService.getEmployeesByCompanyId(companyId).subscribe({
        next: (employees) => {
          this.employees = employees.map((emp) => ({
            ...emp,
            selected: false,
          }));
          console.log('Employees loaded:', employees);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading employees:', err);
          this.toastr.error('שגיאה בטעינת עובדים.');
          this.cdr.markForCheck();
        },
      });
    } catch (err) {
      console.error('Unexpected error loading employees:', err);
      this.toastr.error('שגיאה בטעינת עובדים.');
      this.cdr.markForCheck();
    }
  }

  async loadServices(companyId: string) {
    try {
      console.log(`Attempting to load services for companyId: ${companyId}`);
      const testRef = doc(this.firestore, 'businesses', companyId);
      await getDoc(testRef);
      console.log(
        'Firestore connectivity test passed for companyId:',
        companyId
      );

      this.servicesService.getServicesByCompanyId(companyId).subscribe({
        next: (services) => {
          console.log('Services loaded:', services);
          this.services = services;
          if (services.length === 0) {
            console.warn('No services found for companyId:', companyId);
            this.toastr.warning('לא נמצאו שירותים עבור עסק זה.');
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading services:', err);
          this.error = 'שגיאה בטעינת שירותים: ' + (err.message || 'לא ידוע');
          this.toastr.error(this.error);
          this.loading = false;
          this.cdr.markForCheck();
        },
        complete: () => {
          console.log('Service loading completed.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
    } catch (err) {
      console.error('Unexpected error loading services:', err);
      this.error = 'שגיאה לא צפויה בטעינת שירותים.';
      this.toastr.error(this.error);
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadReviews(companyId: string) {
    try {
      console.log(`Loading reviews for companyId: ${companyId}`);
      const ref = collection(this.firestore, `businesses/${companyId}/reviews`);
      const snapshot = await getDocs(ref);
      this.reviews = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as Review)
      );
      console.log('Reviews loaded:', this.reviews);
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error loading reviews:', err);
      this.toastr.error('שגיאה בטעינת ביקורות.');
      this.cdr.markForCheck();
    }
  }

  openServiceModal() {
    if (!this.companyId) {
      this.toastr.error('לא נמצא מזהה חברה.');
      return;
    }
    if (this.userRole !== 'owner') {
      return;
    }
    
    // איפוס תמונה ומצב עריכה
    this.serviceImagePreview = null;
    this.selectedServiceFile = null;
    this.editingServiceId = null;
    
    this.newService = {
      name: '',
      description: '',
      price: 0,
      companyId: this.companyId,
      category: '',
      duration: 0,
      availability: 'available',
      tags: [],
      isFeatured: false,
      requiresEmployee: false,
    };
    this.tagsInput = '';
    this.serviceFormStep = 1;
    this.employees.forEach((employee) => (employee.selected = false));
    this.showServiceModal = true;
    this.cdr.markForCheck();
  }

  closeServiceModal() {
    this.showServiceModal = false;
    this.serviceFormStep = 1;
    this.cdr.markForCheck();
  }

  openEmployeeModal() {
    if (!this.companyId) {
      this.toastr.error('לא נמצא מזהה חברה.');
      return;
    }
    if (this.userRole !== 'owner') {
      return;
    }
    
    // איפוס תמונה ומצב עריכה
    this.employeeImagePreview = null;
    this.selectedEmployeeFile = null;
    this.editingEmployeeId = null;
    
    // איפוס שעות עבודה
    this.employeeHours = {
      'ראשון': { from: '', to: '' },
      'שני': { from: '', to: '' },
      'שלישי': { from: '', to: '' },
      'רביעי': { from: '', to: '' },
      'חמישי': { from: '', to: '' },
      'שישי': { from: '', to: '' },
      'שבת': { from: '', to: '' },
    };
    
    this.newEmployee = {
      id: '',
      name: '',
      role: '',
      phone: '',
      companyId: this.companyId,
      services: [],
    };
    this.showEmployeeModal = true;
    this.cdr.markForCheck();
  }

  editEmployee(employee: Employee) {
    if (!this.companyId) {
      this.toastr.error('לא נמצא מזהה חברה.');
      return;
    }
    
    // טעינת הנתונים הקיימים
    this.editingEmployeeId = employee.id || null;
    this.newEmployee = { ...employee };
    this.employeeImagePreview = employee.imageUrl || null;
    this.selectedEmployeeFile = null;
    
    // טעינת שעות עבודה
    this.employeeHours = {
      'ראשון': { from: '', to: '' },
      'שני': { from: '', to: '' },
      'שלישי': { from: '', to: '' },
      'רביעי': { from: '', to: '' },
      'חמישי': { from: '', to: '' },
      'שישי': { from: '', to: '' },
      'שבת': { from: '', to: '' },
    };
    
    if (employee.openingHours && employee.openingHours.length > 0) {
      employee.openingHours.forEach(hour => {
        if (this.employeeHours[hour.day]) {
          this.employeeHours[hour.day] = { from: hour.from, to: hour.to };
        }
      });
    }
    
    this.showEmployeeModal = true;
    document.body.classList.add('modal-open');
    this.cdr.markForCheck();
  }

  closeEmployeeModal() {
    this.showEmployeeModal = false;
    this.cdr.markForCheck();
  }

  openBookingModal(service: Service) {
    console.log('openBookingModal called', {
      user: this.auth.currentUser,
      userRole: this.userRole,
      isOwner: this.isOwner,
      service,
      requiresEmployee: service.requiresEmployee,
    });
    if (!this.auth.currentUser) {
      this.toastr.error('על מנת להזמין עליך להירשם.');
      return;
    }
    if (this.userRole !== 'customer') {
      this.toastr.error('רק לקוחות יכולים להזמין שירותים.');
      return;
    }
    this.selectedService = service;
    this.selectedEmployee = null;
    this.selectedDate = null;
    this.selectedTime = null;
    this.bookingNotes = '';
    this.bookingStep = service.requiresEmployee ? 1 : 2;
    this.showBookingModal = true;
    console.log(
      'showBookingModal:',
      this.showBookingModal,
      'bookingStep:',
      this.bookingStep
    );
    this.cdr.markForCheck();
  }

  closeBookingModal() {
    this.showBookingModal = false;
    this.selectedService = null;
    this.selectedEmployee = null;
    this.selectedDate = null;
    this.selectedTime = null;
    this.bookingNotes = '';
    this.bookingStep = 1;
    this.availableTimes = [];
    this.cdr.markForCheck();
  }

  onDateSelect(date: Date) {
    if (dateFns.isBefore(date, dateFns.startOfToday())) {
      this.toastr.warning('לא ניתן לבחור תאריך בעבר.');
      return;
    }
    
    // שמירת התאריך ללא שינוי timezone
    // יצירת תאריך חדש באזור הזמן המקומי
    const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    this.selectedDate = localDate;
    
    console.log('📅 Date selected:', date);
    console.log('📅 Local date saved:', localDate);
    console.log('📅 Will be saved as:', this.formatDateForStorage(localDate));
    
    this.calculateAvailableTimes(date);
    this.bookingStep = 3;
    this.cdr.markForCheck();
  }
  
  private formatDateForStorage(date: Date): string {
    // פורמט YYYY-MM-DD ללא המרת timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  selectTime(time: string) {
    this.selectedTime = time;
    this.bookingStep = 4;
    this.cdr.markForCheck();
  }

  nextBookingStep() {
    console.log('nextBookingStep called', {
      bookingStep: this.bookingStep,
      selectedEmployee: this.selectedEmployee,
      selectedDate: this.selectedDate,
      selectedTime: this.selectedTime,
      requiresEmployee: this.selectedService?.requiresEmployee,
    });
    if (
      this.bookingStep === 1 &&
      !this.selectedEmployee &&
      this.selectedService?.requiresEmployee
    ) {
      this.toastr.error('נא לבחור עובד.');
      return;
    }
    if (this.bookingStep === 2 && !this.selectedDate) {
      this.toastr.error('נא לבחור תאריך.');
      return;
    }
    if (this.bookingStep === 3 && !this.selectedTime) {
      this.toastr.error('נא לבחור שעה.');
      return;
    }
    this.bookingStep++;
    console.log('bookingStep updated to:', this.bookingStep);
    this.cdr.markForCheck();
  }

  previousBookingStep() {
    if (this.bookingStep > 1) {
      this.bookingStep--;
      if (this.bookingStep === 2) {
        this.selectedTime = null;
        this.availableTimes = [];
      }
      this.cdr.markForCheck();
    }
  }

  async confirmBooking() {
    if (
      !this.auth.currentUser ||
      !this.companyId ||
      !this.selectedService ||
      !this.selectedDate ||
      !this.selectedTime
    ) {
      this.toastr.error('שגיאה: נתונים חסרים.');
      return;
    }

    const dateForStorage = this.formatDateForStorage(this.selectedDate);
    
    console.log('📅 Selected Date Object:', this.selectedDate);
    console.log('📅 Date for storage:', dateForStorage);
    console.log('⏰ Selected Time:', this.selectedTime);

    const appointment: Appointment = {
      companyId: this.companyId,
      serviceId: this.selectedService.id!,
      serviceName: this.selectedService.name,
      employeeId: this.selectedEmployee?.id ?? null,
      employeeName: this.selectedEmployee?.name ?? '',
      customerId: this.auth.currentUser.uid,
      customerName: this.auth.currentUser.displayName || '',
      date: dateForStorage,
      time: this.selectedTime,
      duration:
        this.selectedService.duration ||
        this.business?.appointmentInterval ||
        30,
      createdAt: new Date().toISOString(),
      status: 'pending',
      notes: this.bookingNotes,
    };

    try {
      console.log('✅ Confirming booking with appointment:', appointment);
      const existingAppointments = await firstValueFrom(
        this.appointmentService.getAppointmentsByDate(
          this.companyId,
          appointment.date
        )
      );
      
      let isTimeTaken = false;
      
      // אם השירות דורש עובד ספציפי
      if (this.selectedService?.requiresEmployee && appointment.employeeId) {
        // בדוק אם העובד הספציפי תפוס
        isTimeTaken = existingAppointments?.some(
          (appt) =>
            appt.time === appointment.time &&
            appt.employeeId === appointment.employeeId
        ) || false;
        
        console.log(`🔍 Employee-specific check: Employee ${appointment.employeeName} at ${appointment.time} - Taken: ${isTimeTaken}`);
      }
      // אם השירות לא דורש עובד ספציפי
      else if (!this.selectedService?.requiresEmployee) {
        // בדוק אם כל העובדים תפוסים
        const busyEmployeesAtTime = existingAppointments?.filter(
          (appt) => appt.time === appointment.time
        ) || [];
        const totalEmployees = this.employees.length;
        isTimeTaken = busyEmployeesAtTime.length >= totalEmployees && totalEmployees > 0;
        
        console.log(`🔍 All employees check: ${busyEmployeesAtTime.length}/${totalEmployees} busy at ${appointment.time} - Taken: ${isTimeTaken}`);
        
        // אם לא כל העובדים תפוסים, שבץ לעובד זמין
        if (!isTimeTaken && busyEmployeesAtTime.length < totalEmployees) {
          const busyEmployeeIds = busyEmployeesAtTime.map(a => a.employeeId);
          const availableEmployee = this.employees.find(e => !busyEmployeeIds.includes(e.id));
          
          if (availableEmployee) {
            appointment.employeeId = availableEmployee.id;
            appointment.employeeName = availableEmployee.name;
            console.log(`✅ Auto-assigned to available employee: ${availableEmployee.name}`);
          }
        }
      }

      if (isTimeTaken) {
        this.toastr.error('שעה זו כבר תפוסה.');
        return;
      }

      await this.appointmentService.addAppointment(this.companyId, appointment);
      console.log('Toastr success triggered for booking');
      this.toastr.success('התור נקבע בהצלחה!');
      this.closeBookingModal();
    } catch (err) {
      console.error('Error confirming booking:', err);
      this.toastr.error('שגיאה בקביעת התור: ' + (err as Error).message);
    } finally {
      this.cdr.markForCheck();
    }
  }

  async deleteService(service: Service) {
    if (!this.companyId || !service.id) {
      this.toastr.error('חסר מזהה עסק או שירות.');
      return;
    }
    if (confirm(`האם אתה בטוח שברצונך למחוק את השירות "${service.name}"?`)) {
      try {
        await this.servicesService.deleteService(this.companyId, service.id);
        this.services = this.services.filter((s) => s.id !== service.id);
        console.log('Toastr success triggered for service deletion');
        this.toastr.success('השירות נמחק בהצלחה!');
        this.cdr.markForCheck();
      } catch (err) {
        console.error('Error deleting service:', err);
        this.toastr.error('שגיאה במחיקת השירות: ' + (err as Error).message);
      }
    }
  }

  calculateAvailableTimes(date: Date) {
    this.availableTimes = [];
    
    const dayOfWeek = [
      'ראשון',
      'שני',
      'שלישי',
      'רביעי',
      'חמישי',
      'שישי',
      'שבת',
    ][date.getDay()];
    
    const dateStr = this.formatDateForStorage(date);
    
    // 🔥 בדיקה חדשה: האם העובד בחופש?
    if (this.selectedEmployee) {
      const isAbsent = this.absenceService.isEmployeeAbsent(
        this.absences,
        this.selectedEmployee.id!,
        dateStr
      );
      
      if (isAbsent) {
        console.log(`🏖️ Employee ${this.selectedEmployee.name} is on vacation on ${dateStr}`);
        this.toastr.warning(`${this.selectedEmployee.name} בחופש בתאריך זה`);
        this.cdr.markForCheck();
        return; // אין שעות זמינות
      }
    }
    
    let hours;
    
    // אם יש עובד נבחר ויש לו שעות עבודה משלו, השתמש בהן
    if (this.selectedEmployee?.openingHours && this.selectedEmployee.openingHours.length > 0) {
      hours = this.selectedEmployee.openingHours.find((h) => h.day === dayOfWeek);
      console.log(`👤 Using employee ${this.selectedEmployee.name} working hours:`, hours);
    }
    
    // אחרת, השתמש בשעות העסק
    if (!hours && this.business?.openingHours) {
      hours = this.business.openingHours.find((h) => h.day === dayOfWeek);
      console.log('🏢 Using business working hours:', hours);
    }
    
    if (!hours) {
      console.log('❌ No working hours found for', dayOfWeek);
      return;
    }

    const interval =
      this.selectedService?.duration || this.business?.appointmentInterval || 30;
    let currentTime = new Date(`1970-01-01T${hours.from}:00`);
    const endTime = new Date(`1970-01-01T${hours.to}:00`);

    const isToday = dateFns.isSameDay(date, new Date());
    const now = new Date();

    while (currentTime <= endTime) {
      const timeStr = currentTime.toTimeString().slice(0, 5);
      if (isToday) {
        const timeDate = new Date(`1970-01-01T${timeStr}:00`);
        if (
          timeDate.getTime() >
          now.getHours() * 3600000 + now.getMinutes() * 60000
        ) {
          this.availableTimes.push(timeStr);
        }
      } else {
        this.availableTimes.push(timeStr);
      }
      currentTime.setMinutes(currentTime.getMinutes() + interval);
    }

    const dateForQuery = this.formatDateForStorage(date);
    console.log('🔍 Querying appointments for date:', dateForQuery);
    
    this.appointmentService
      .getAppointmentsByDate(this.companyId!, dateForQuery)
      .subscribe({
        next: (appointments) => {
          console.log('📅 All appointments for date:', appointments);
          console.log('👤 Selected employee:', this.selectedEmployee);
          console.log('🎯 Selected service requires employee:', this.selectedService?.requiresEmployee);
          
          // סינון תורים - תמיד לפי העובד הנבחר
          const selectedEmployeeId = this.selectedEmployee?.id;
          const selectedEmployeeName = this.selectedEmployee?.name || 'Unknown';
          
          this.availableTimes = this.availableTimes.filter((time) => {
            // אם השירות דורש עובד ספציפי
            if (this.selectedService?.requiresEmployee && selectedEmployeeId) {
              const isEmployeeBusy = appointments.some(
                (appt) => 
                  appt.time === time && 
                  appt.employeeId === selectedEmployeeId
              );
              
              console.log(`⏰ Time ${time} - Employee ${selectedEmployeeName} (ID: ${selectedEmployeeId}) - Busy: ${isEmployeeBusy}`);
              return !isEmployeeBusy;
            }
            
            // אם השירות לא דורש עובד ספציפי
            // בדוק אם כל העובדים תפוסים באותה שעה
            if (!this.selectedService?.requiresEmployee) {
              const busyEmployees = appointments.filter((appt) => appt.time === time);
              const totalEmployees = this.employees.length;
              const allEmployeesBusy = busyEmployees.length >= totalEmployees && totalEmployees > 0;
              
              console.log(`⏰ Time ${time} - All employees check - Busy: ${busyEmployees.length}/${totalEmployees} - Available: ${!allEmployeesBusy}`);
              return !allEmployeesBusy;
            }
            
            // ברירת מחדל - השעה זמינה
            return true;
          });
          
          console.log('✅ Available times after filtering:', this.availableTimes);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading appointments:', err);
          this.toastr.error('שגיאה בטעינת תורים קיימים.');
          this.cdr.markForCheck();
        },
      });
  }

  dayModifier(event: CalendarMonthViewBeforeRenderEvent) {
    event.body.forEach((day) => {
      const isPast = dateFns.isBefore(day.date, dateFns.startOfToday());
      const isWeekend =
        dateFns.isFriday(day.date) || dateFns.isSaturday(day.date);
      day.cssClass = isPast || isWeekend ? 'cal-disabled' : '';
      if (this.selectedDate && dateFns.isSameDay(day.date, this.selectedDate)) {
        day.cssClass += ' cal-selected';
      }
    });
    this.cdr.markForCheck();
  }

  nextServiceStep() {
    if (!this.isServiceFormValid()) {
      this.toastr.error('נא למלא את כל השדות הנדרשים.');
      return;
    }
    if (this.newService.requiresEmployee) {
      this.serviceFormStep = 2;
    } else {
      this.addNewService();
    }
    this.cdr.markForCheck();
  }

  isServiceFormValid(): boolean {
    return !!(
      this.newService.name &&
      this.newService.description &&
      this.newService.price > 0 &&
      this.newService.companyId &&
      this.newService.category &&
      this.newService.duration > 0 &&
      this.newService.availability
    );
  }

  isEmployeeFormValid(): boolean {
    return this.hasSelectedEmployees();
  }

  isNewEmployeeFormValid(): boolean {
    return !!(
      this.newEmployee.name &&
      this.newEmployee.role &&
      this.newEmployee.phone &&
      this.newEmployee.companyId
    );
  }

  hasSelectedEmployees(): boolean {
    return this.employees.some((employee) => employee.selected);
  }

  formatDateTime(date: Date): string {
    return date.toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  async addNewService() {
    if (!this.isServiceFormValid()) {
      this.toastr.error('נא למלא את כל השדות הנדרשים.');
      return;
    }
    if (this.newService.requiresEmployee && !this.isEmployeeFormValid()) {
      this.toastr.error('נא לבחור לפחות עובד אחד.');
      return;
    }
    if (!this.companyId) {
      this.toastr.error('לא נמצא מזהה חברה.');
      return;
    }

    this.newService.tags = this.tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag);
    this.newService.updatedAt = new Date().toISOString();

    try {
      // העלאת תמונה אם נבחרה
      if (this.selectedServiceFile) {
        const imageUrl = await this.uploadServiceImage(this.selectedServiceFile);
        if (imageUrl) {
          this.newService.imageUrl = imageUrl;
        }
      }
      
      // עדכון או הוספה
      if (this.editingServiceId) {
        // מצב עריכה
        await this.servicesService.updateService(
          this.companyId,
          this.editingServiceId,
          this.newService
        );
        console.log('Toastr success triggered for service update');
        this.toastr.success('השירות עודכן בהצלחה!');
      } else {
        // מצב הוספה
        this.newService.createdAt = new Date().toISOString();
        const serviceId = await this.servicesService.addService(this.newService);
        
        if (this.newService.requiresEmployee) {
          const selectedEmployees = this.employees.filter((emp) => emp.selected);
          for (const employee of selectedEmployees) {
            if (!employee.id) {
              this.toastr.error(`לא נמצא מזהה לעובד ${employee.name}`);
              continue;
            }
            const updatedServices = [...(employee.services || []), serviceId];
            await this.employeeService.updateEmployee(
              this.companyId,
              employee.id,
              { services: updatedServices }
            );
          }
        }
        console.log('Toastr success triggered for new service');
        this.toastr.success('שירות נוסף בהצלחה!');
      }
      
      this.closeServiceModal();
      if (this.companyId) {
        await this.loadServices(this.companyId);
      }
    } catch (err) {
      console.error('Error saving service:', err);
      this.toastr.error('שגיאה בשמירת שירות: ' + (err as Error).message);
    } finally {
      this.cdr.markForCheck();
    }
  }

  editService(service: Service) {
    if (!this.companyId) {
      this.toastr.error('לא נמצא מזהה חברה.');
      return;
    }
    
    // טעינת הנתונים הקיימים
    this.editingServiceId = service.id || null;
    this.newService = { ...service };
    this.tagsInput = service.tags?.join(', ') || '';
    this.serviceImagePreview = service.imageUrl || null;
    this.selectedServiceFile = null;
    this.serviceFormStep = 1;
    this.showServiceModal = true;
    document.body.classList.add('modal-open');
    this.cdr.markForCheck();
  }

  async addNewEmployee() {
    if (!this.isNewEmployeeFormValid()) {
      this.toastr.error('נא למלא את כל השדות הנדרשים.');
      return;
    }
    try {
      // המרת שעות העבודה לפורמט הנכון
      const openingHours: { day: string; from: string; to: string }[] = [];
      
      for (const day of this.weekDays) {
        const hours = this.employeeHours[day];
        if (hours && hours.from && hours.to) {
          openingHours.push({
            day: day,
            from: hours.from,
            to: hours.to
          });
        }
      }
      
      // הוספת שעות העבודה לעובד
      if (openingHours.length > 0) {
        this.newEmployee.openingHours = openingHours;
        console.log('👤 Employee working hours:', openingHours);
      }
      
      // העלאת תמונה אם נבחרה
      if (this.selectedEmployeeFile) {
        const imageUrl = await this.uploadEmployeeImage(this.selectedEmployeeFile);
        if (imageUrl) {
          this.newEmployee.imageUrl = imageUrl;
        }
      }
      
      // עדכון או הוספה
      if (this.editingEmployeeId) {
        // מצב עריכה
        await this.employeeService.updateEmployee(
          this.companyId!,
          this.editingEmployeeId,
          this.newEmployee
        );
        console.log('Toastr success triggered for employee update');
        this.toastr.success('העובד עודכן בהצלחה!');
      } else {
        // מצב הוספה
        await this.employeeService.addEmployee(this.newEmployee);
        console.log('Toastr success triggered for new employee');
        this.toastr.success('עובד נוסף בהצלחה!');
      }
      
      this.closeEmployeeModal();
      if (this.companyId) {
        await this.loadEmployees(this.companyId);
      }
    } catch (err) {
      console.error('Error saving employee:', err);
      this.toastr.error('שגיאה בשמירת עובד: ' + (err as Error).message);
    } finally {
      this.cdr.markForCheck();
    }
  }

  async deleteEmployee(employee: Employee) {
    if (!this.companyId || !employee.id) {
      this.toastr.error('חסר מזהה עסק או עובד.');
      return;
    }
    if (confirm(`האם אתה בטוח שברצונך למחוק את העובד "${employee.name}"?`)) {
      try {
        await this.employeeService.deleteEmployee(this.companyId, employee.id);
        this.employees = this.employees.filter((e) => e.id !== employee.id);
        console.log('Toastr success triggered for employee deletion');
        this.toastr.success('העובד נמחק בהצלחה!');
        this.cdr.markForCheck();
      } catch (err) {
        console.error('Error deleting employee:', err);
        this.toastr.error('שגיאה במחיקת העובד: ' + (err as Error).message);
      }
    }
  }

  openDescriptionModal() {
    if (!this.isOwner) {
      return;
    }
    this.businessDescription = this.business?.description || 'ברוכים הבאים! כאן תמצאו את השירותים המובילים שלנו, הכירו את הצוות המקצועי שלנו וקראו מה לקוחות מרוצים חושבים עלינו.';
    this.showDescriptionModal = true;
    document.body.classList.add('modal-open');
    this.cdr.markForCheck();
  }

  closeDescriptionModal() {
    this.showDescriptionModal = false;
    this.businessDescription = '';
    document.body.classList.remove('modal-open');
    this.cdr.markForCheck();
  }

  async saveDescription() {
    if (!this.companyId || !this.businessDescription.trim()) {
      this.toastr.error('נא להזין תיאור.');
      return;
    }

    try {
      // עדכון בדאטהבייס
      const businessRef = doc(this.firestore, 'businesses', this.companyId);
      await updateDoc(businessRef, {
        description: this.businessDescription.trim()
      });

      // עדכון מקומי
      if (this.business) {
        this.business.description = this.businessDescription.trim();
      }

      console.log('Toastr success triggered for description update');
      this.toastr.success('התיאור עודכן בהצלחה!');
      this.closeDescriptionModal();
    } catch (err) {
      console.error('Error updating description:', err);
      this.toastr.error('שגיאה בעדכון התיאור: ' + (err as Error).message);
    } finally {
      this.cdr.markForCheck();
    }
  }

  prevMonth() {
    this.viewDate = dateFns.subMonths(this.viewDate, 1);
    this.selectedDate = null;
    this.availableTimes = [];
    this.cdr.markForCheck();
  }

  nextMonth() {
    this.viewDate = dateFns.addMonths(this.viewDate, 1);
    this.selectedDate = null;
    this.availableTimes = [];
    this.cdr.markForCheck();
  }

  async uploadServiceImage(file: File): Promise<string | null> {
    try {
      const filePath = `services/${this.companyId}/${Date.now()}_${file.name}`;
      const storageRef = ref(this.storage, filePath);
      
      console.log('📤 Uploading service image to:', filePath);
      await uploadBytes(storageRef, file);
      
      const downloadURL = await getDownloadURL(storageRef);
      console.log('✅ Service image uploaded:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('❌ Error uploading service image:', error);
      this.toastr.error('שגיאה בהעלאת תמונת השירות');
      return null;
    }
  }

  async uploadEmployeeImage(file: File): Promise<string | null> {
    try {
      const filePath = `employees/${this.companyId}/${Date.now()}_${file.name}`;
      const storageRef = ref(this.storage, filePath);
      
      console.log('📤 Uploading employee image to:', filePath);
      await uploadBytes(storageRef, file);
      
      const downloadURL = await getDownloadURL(storageRef);
      console.log('✅ Employee image uploaded:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('❌ Error uploading employee image:', error);
      this.toastr.error('שגיאה בהעלאת תמונת העובד');
      return null;
    }
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.src !== this.fallbackImage) {
      img.src = this.fallbackImage;
      img.onerror = null; // Prevent infinite loop
    }
  }

  onServiceImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedServiceFile = input.files[0];
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.serviceImagePreview = e.target?.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(this.selectedServiceFile);
    }
  }

  onEmployeeImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedEmployeeFile = input.files[0];
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.employeeImagePreview = e.target?.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(this.selectedEmployeeFile);
    }
  }

  // ========================================
  // Absence Management Methods
  // ========================================

  async loadAbsences(companyId: string) {
    try {
      console.log(`🏖️ Loading absences for companyId: ${companyId}`);
      this.absences = await this.absenceService.getAllAbsences(companyId);
      console.log('✅ Absences loaded:', this.absences);
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error loading absences:', err);
      this.toastr.error('שגיאה בטעינת חופשות.');
    }
  }

  openAbsenceModal(employee?: Employee) {
    console.log('🏖️ openAbsenceModal called!');
    console.log('   isOwner:', this.isOwner);
    console.log('   employee:', employee);
    
    if (!this.isOwner) {
      console.log('❌ User is not owner - modal blocked');
      this.toastr.error('רק בעל העסק יכול לנהל חופשות');
      return;
    }
    
    // Reset form
    this.newAbsence = {
      employeeId: employee?.id || '',
      employeeName: employee?.name || '',
      companyId: this.companyId!,
      startDate: '',
      endDate: '',
      type: 'vacation',
      status: 'pending',
      reason: '',
      notes: '',
      createdAt: '',
    };
    
    console.log('✅ Opening absence modal');
    console.log('   newAbsence:', this.newAbsence);
    
    this.showAbsenceModal = true;
    document.body.classList.add('modal-open');
    
    // Force change detection
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
    
    console.log('   showAbsenceModal:', this.showAbsenceModal);
  }

  closeAbsenceModal() {
    this.showAbsenceModal = false;
    document.body.classList.remove('modal-open');
    this.cdr.markForCheck();
  }

  async addAbsence() {
    if (!this.newAbsence.startDate || !this.newAbsence.endDate) {
      this.toastr.error('נא למלא תאריכי התחלה וסיום');
      return;
    }

    if (this.newAbsence.startDate > this.newAbsence.endDate) {
      this.toastr.error('תאריך ההתחלה חייב להיות לפני תאריך הסיום');
      return;
    }

    try {
      await this.absenceService.addAbsence(this.companyId!, this.newAbsence);
      this.toastr.success('חופשה נוספה בהצלחה!');
      await this.loadAbsences(this.companyId!);
      this.closeAbsenceModal();
    } catch (err) {
      console.error('Error adding absence:', err);
      this.toastr.error('שגיאה בהוספת חופשה: ' + (err as Error).message);
    }
  }

  async approveAbsence(absence: EmployeeAbsence) {
    if (!absence.id) {
      this.toastr.error('שגיאה: חסר מזהה חופשה');
      return;
    }

    try {
      await this.absenceService.updateAbsenceStatus(
        this.companyId!,
        absence.id,
        'approved',
        this.auth.currentUser?.uid || ''
      );
      this.toastr.success('בקשת החופש אושרה!');
      await this.loadAbsences(this.companyId!);
    } catch (err) {
      console.error('Error approving absence:', err);
      this.toastr.error('שגיאה באישור בקשה: ' + (err as Error).message);
    }
  }

  async rejectAbsence(absence: EmployeeAbsence) {
    if (!absence.id) {
      this.toastr.error('שגיאה: חסר מזהה חופשה');
      return;
    }

    try {
      await this.absenceService.updateAbsenceStatus(
        this.companyId!,
        absence.id,
        'rejected',
        this.auth.currentUser?.uid || ''
      );
      this.toastr.success('בקשת החופש נדחתה');
      await this.loadAbsences(this.companyId!);
    } catch (err) {
      console.error('Error rejecting absence:', err);
      this.toastr.error('שגיאה בדחיית בקשה: ' + (err as Error).message);
    }
  }

  async deleteAbsence(absenceId: string) {
    if (!confirm('האם אתה בטוח שברצונך למחוק חופשה זו?')) {
      return;
    }

    try {
      await this.absenceService.deleteAbsence(this.companyId!, absenceId);
      this.toastr.success('החופשה נמחקה בהצלחה');
      await this.loadAbsences(this.companyId!);
    } catch (err) {
      console.error('Error deleting absence:', err);
      this.toastr.error('שגיאה במחיקת חופשה: ' + (err as Error).message);
    }
  }

  getEmployeeAbsences(employeeId: string): EmployeeAbsence[] {
    return this.absences.filter((absence) => absence.employeeId === employeeId);
  }

  getEmployeeAbsencesCount(employeeId: string | undefined): number {
    if (!employeeId) return 0;
    return this.absences.filter(
      (absence) =>
        absence.employeeId === employeeId && absence.status === 'approved'
    ).length;
  }

  getPendingAbsences(): EmployeeAbsence[] {
    return this.absences.filter((absence) => absence.status === 'pending');
  }

  getAbsenceTypeText(type: string): string {
    const types: { [key: string]: string } = {
      vacation: 'חופשה',
      sick: 'מחלה',
      personal: 'אישי',
      other: 'אחר',
    };
    return types[type] || type;
  }

  getAbsenceStatusText(status: string): string {
    const statuses: { [key: string]: string } = {
      pending: 'ממתין לאישור',
      approved: 'מאושר',
      rejected: 'נדחה',
    };
    return statuses[status] || status;
  }
}
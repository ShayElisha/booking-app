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
} from '@angular/fire/firestore';
import { ToastrService } from 'ngx-toastr';
import { ServicesService } from '../../services/service.service';
import { EmployeeService } from '../../services/employee.service';
import { AppointmentService } from '../../services/appointment.service';
import { Service } from '../../models/service';
import { Employee } from '../../models/employee';
import { Appointment } from '../../models/appointment';
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
  availableTimes: string[] = [];
  loading = false;
  error = '';
  isOwner = false;
  showServiceModal = false;
  showBookingModal = false;
  showEmployeeModal = false;
  bookingStep = 1;
  selectedDate: Date | null = null;
  selectedTime: string | null = null;
  bookingNotes: string = '';
  serviceFormStep = 1;

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
  tagsInput = '';
  selectedService: Service | null = null;
  selectedEmployee: Employee | null = null;
  today = new Date(new Date().setHours(0, 0, 0, 0));

  // Calendar properties
  viewDate: Date = new Date();
  events: CalendarEvent[] = [];
  locale: string = 'he';

  constructor(
    private route: ActivatedRoute,
    private auth: Auth,
    private firestore: Firestore,
    private toastr: ToastrService,
    private servicesService: ServicesService,
    private employeeService: EmployeeService,
    private appointmentService: AppointmentService,
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

        console.log('Loading business data for companyId:', this.companyId);
        await this.loadBusinessData(user?.uid, this.companyId!);
        if (!this.error) {
          this.isOwner = this.userRole === 'owner';
          await Promise.all([
            this.loadEmployees(this.companyId!),
            this.loadServices(this.companyId!),
            this.loadReviews(this.companyId!),
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
      const cachedData = localStorage.getItem('business');
      if (cachedData) {
        const businessData = JSON.parse(cachedData);
        if (businessData.companyId === companyId) {
          this.businessName = businessData.businessName || 'ללא שם עסק';
          this.logoUrl = businessData.logoUrl || this.fallbackImage;
          this.isOwner = uid ? businessData.ownerUid === uid : false;
          this.business = businessData as AppBusiness;
          this.cdr.markForCheck();
          return;
        }
      }

      const businessRef = doc(this.firestore, 'businesses', companyId);
      const businessSnap = await getDoc(businessRef);

      if (businessSnap.exists()) {
        const business = businessSnap.data() as AppBusiness;
        this.businessName = business.businessName || 'ללא שם עסק';
        this.logoUrl = business.logoUrl || this.fallbackImage;
        this.isOwner = uid ? business.ownerUid === uid : false;
        this.business = business;
        localStorage.setItem(
          'business',
          JSON.stringify({
            ...business,
            ownerUid: uid,
            companyId: companyId,
            logoUrl: this.logoUrl,
          })
        );
      } else {
        this.error = 'העסק לא נמצא.';
        this.toastr.error(this.error);
      }
    } catch (err) {
      console.error('Error loading business data:', err);
      this.error = 'שגיאה בטעינת פרטי העסק.';
      this.toastr.error(this.error);
      this.logoUrl = this.fallbackImage;
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
    this.selectedDate = date;
    this.calculateAvailableTimes(date);
    this.bookingStep = 3;
    this.cdr.markForCheck();
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

    const appointment: Appointment = {
      companyId: this.companyId,
      serviceId: this.selectedService.id!,
      serviceName: this.selectedService.name,
      employeeId: this.selectedEmployee?.id ?? null,
      employeeName: this.selectedEmployee?.name ?? '',
      customerId: this.auth.currentUser.uid,
      customerName: this.auth.currentUser.displayName || '',
      date: this.selectedDate.toISOString().split('T')[0],
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
      console.log('Confirming booking with appointment:', appointment);
      const existingAppointments = await firstValueFrom(
        this.appointmentService.getAppointmentsByDate(
          this.companyId,
          appointment.date
        )
      );
      const isTimeTaken = existingAppointments?.some(
        (appt) =>
          appt.time === appointment.time &&
          (!this.selectedService?.requiresEmployee ||
            appt.employeeId === appointment.employeeId)
      );

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
    if (!this.business?.openingHours) return;

    const dayOfWeek = [
      'ראשון',
      'שני',
      'שלישי',
      'רביעי',
      'חמישי',
      'שישי',
      'שבת',
    ][date.getDay()];
    const hours = this.business.openingHours.find((h) => h.day === dayOfWeek);
    if (!hours) return;

    const interval =
      this.selectedService?.duration || this.business.appointmentInterval || 30;
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

    this.appointmentService
      .getAppointmentsByDate(this.companyId!, date.toISOString().split('T')[0])
      .subscribe({
        next: (appointments) => {
          this.availableTimes = this.availableTimes.filter(
            (time) =>
              !appointments.some(
                (appt) =>
                  appt.time === time &&
                  (!this.selectedService?.requiresEmployee ||
                    appt.employeeId === this.selectedEmployee?.id)
              )
          );
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
    this.newService.createdAt = new Date().toISOString();
    this.newService.updatedAt = new Date().toISOString();

    try {
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
            {
              services: updatedServices,
            }
          );
        }
      }
      console.log('Toastr success triggered for new service');
      this.toastr.success('שירות נוסף בהצלחה!');
      this.closeServiceModal();
      if (this.companyId) {
        await this.loadServices(this.companyId); // Reload services
      }
    } catch (err) {
      console.error('Error adding service:', err);
      this.toastr.error('שגיאה בהוספת שירות: ' + (err as Error).message);
    } finally {
      this.cdr.markForCheck();
    }
  }

  async addNewEmployee() {
    if (!this.isNewEmployeeFormValid()) {
      this.toastr.error('נא למלא את כל השדות הנדרשים.');
      return;
    }
    try {
      await this.employeeService.addEmployee(this.newEmployee);
      console.log('Toastr success triggered for new employee');
      this.toastr.success('עובד נוסף בהצלחה!');
      this.closeEmployeeModal();
      if (this.companyId) {
        await this.loadEmployees(this.companyId);
      }
    } catch (err) {
      console.error('Error adding employee:', err);
      this.toastr.error('שגיאה בהוספת עובד: ' + (err as Error).message);
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
}
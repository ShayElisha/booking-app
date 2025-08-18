import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { BusinessService } from '../../services/business.service';
import { AppBusiness } from '../../models/app-business';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-register-business',
  templateUrl: './register-business.component.html',
  styleUrls: ['./register-business.component.scss'],
})
export class RegisterBusinessComponent {
  businessForm: FormGroup;
  loading = false;
  successMsg = '';
  errorMsg = '';
  imagePreview: string | null = null;
  selectedFile: File | null = null;

  weekDays: string[] = [
    'ראשון',
    'שני',
    'שלישי',
    'רביעי',
    'חמישי',
    'שישי',
    'שבת',
  ];

  appointmentIntervals: number[] = [15, 30, 60];

  constructor(
    private fb: FormBuilder,
    private businessService: BusinessService,
    private toastr: ToastrService,
    private router: Router,
    private firestore: Firestore,
    private storage: AngularFireStorage
  ) {
    this.businessForm = this.fb.group({
      businessName: ['', Validators.required],
      address: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      description: [''],
      openingHours: this.fb.array([]),
      appointmentInterval: [30, Validators.required],
      createdAt: [new Date()],
    });

    this.weekDays.forEach((day) => {
      this.openingHours.push(
        this.fb.group({
          day: [day],
          isActive: [false],
          from: ['09:00', Validators.required],
          to: ['17:00', Validators.required],
        })
      );
    });
  }

  get openingHours(): FormArray {
    const array = this.businessForm.get('openingHours') as FormArray;
    return array ?? this.fb.array([]);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      const reader = new FileReader();
      reader.onload = () => (this.imagePreview = reader.result as string);
      reader.readAsDataURL(this.selectedFile);
    }
  }

  async submit() {
    if (this.businessForm.invalid) return;

    this.loading = true;
    const formValue = this.businessForm.value;
    const businessOwner = JSON.parse(localStorage.getItem('business') || '{}');
    let logoUrl = '';

    try {
      if (this.selectedFile) {
        const filePath = `logos/${businessOwner.uid}/${this.selectedFile.name}`;
        const fileRef = this.storage.ref(filePath);
        const uploadTask = this.storage.upload(filePath, this.selectedFile);

        logoUrl = await uploadTask
          .snapshotChanges()
          .pipe(
            finalize(() =>
              fileRef.getDownloadURL().subscribe((url) => (logoUrl = url))
            )
          )
          .toPromise()
          .then(() => logoUrl);
      }

      const docRef = await this.businessService.addBusiness({
        ownerUid: businessOwner.uid,
        businessName: formValue.businessName,
        address: formValue.address,
        phoneNumber: formValue.phoneNumber,
        description: formValue.description,
        openingHours: (formValue.openingHours ?? [])
          .filter((hour: any) => hour.isActive)
          .map((hour: any) => ({
            day: hour.day,
            from: hour.from,
            to: hour.to,
          })),
        logoUrl,
        createdAt: formValue.createdAt,
        appointmentInterval: formValue.appointmentInterval,
      });
      const companyId = docRef.id;

      const business: AppBusiness = {
        companyId,
        ownerUid: businessOwner.uid,
        businessName: formValue.businessName,
        address: formValue.address,
        phoneNumber: formValue.phoneNumber,
        description: formValue.description,
        openingHours: (formValue.openingHours ?? [])
          .filter((hour: any) => hour.isActive)
          .map((hour: any) => ({
            day: hour.day,
            from: hour.from,
            to: hour.to,
          })),
        logoUrl,
        createdAt: formValue.createdAt,
        appointmentInterval: formValue.appointmentInterval,
      };

      const businessRef = doc(this.firestore, 'businesses', companyId);
      await setDoc(businessRef, business, { merge: true });

      const userData = {
        ...businessOwner,
        companyId,
        role: 'business',
        createdAt: new Date(),
      };

      const userRef = doc(this.firestore, 'users', businessOwner.uid);
      await setDoc(userRef, userData, { merge: true });

      localStorage.setItem('business', JSON.stringify(userData));

      this.successMsg = `העסק נרשם בהצלחה! מזהה החברה: ${companyId}`;
      this.errorMsg = '';
      this.businessForm.reset();
      this.imagePreview = null;
      this.selectedFile = null;
      this.openingHours.clear();
      this.weekDays.forEach((day) => {
        this.openingHours.push(
          this.fb.group({
            day: [day],
            isActive: [false],
            from: ['09:00', Validators.required],
            to: ['17:00', Validators.required],
          })
        );
      });

      this.toastr.success(`העסק נרשם בהצלחה! מזהה החברה: ${companyId}`);
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 1500);
    } catch (error) {
      this.errorMsg = 'אירעה שגיאה בהרשמה. נסה שוב.';
      this.successMsg = '';
      this.toastr.error('אירעה שגיאה בהרשמה.');
    } finally {
      this.loading = false;
    }
  }
}

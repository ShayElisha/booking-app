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
    if (this.businessForm.invalid) {
      this.toastr.error('נא למלא את כל השדות הנדרשים.');
      return;
    }

    this.loading = true;
    const formValue = this.businessForm.value;
    const businessOwner = JSON.parse(localStorage.getItem('business') || '{}');
    
    // Validate businessOwner has uid
    if (!businessOwner.uid) {
      this.toastr.error('לא נמצא מזהה משתמש. אנא התחבר מחדש.');
      this.loading = false;
      return;
    }
    
    let logoUrl = '';

    try {
      if (this.selectedFile) {
        console.log('📤 Starting logo upload...');
        console.log('👤 Business owner UID:', businessOwner.uid);
        console.log('📁 File name:', this.selectedFile.name);
        console.log('📏 File size:', this.selectedFile.size, 'bytes');
        
        try {
          const filePath = `logos/${businessOwner.uid}/${Date.now()}_${this.selectedFile.name}`;
          console.log('📁 Upload path:', filePath);
          
          const fileRef = this.storage.ref(filePath);
          const uploadTask = this.storage.upload(filePath, this.selectedFile);

          // Wait for upload to complete and get the download URL (with 60 second timeout)
          await Promise.race([
            new Promise<void>((resolve, reject) => {
              uploadTask.snapshotChanges().pipe(
                finalize(async () => {
                  try {
                    console.log('⏳ Waiting for download URL...');
                    logoUrl = await fileRef.getDownloadURL().toPromise();
                    console.log('✅ Logo uploaded successfully!');
                    console.log('🔗 Download URL:', logoUrl);
                    resolve();
                  } catch (err) {
                    console.error('❌ Error getting download URL:', err);
                    reject(err);
                  }
                })
              ).subscribe({
                next: (snapshot) => {
                  if (snapshot) {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`📊 Upload progress: ${progress.toFixed(0)}%`);
                  }
                },
                error: (err) => {
                  console.error('❌ Upload error:', err);
                  reject(err);
                },
                complete: () => {
                  console.log('📤 Upload stream completed');
                }
              });
            }),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('העלאת הלוגו נכשלה - חריגת זמן')), 60000)
            )
          ]);
        } catch (uploadError: any) {
          console.error('⚠️ Logo upload failed:', uploadError);
          
          // אם יש בעיית הרשאות - המשך בלי לוגו
          if (uploadError.code === 'storage/unauthorized') {
            console.warn('⚠️ Firebase Storage permissions not set. Continuing without logo.');
            this.toastr.warning('לא ניתן להעלות לוגו כרגע. תוכל להוסיף מאוחר יותר.');
            logoUrl = ''; // Continue without logo
          } else {
            // בעיות אחרות - זרוק שגיאה
            throw uploadError;
          }
        }
      } else {
        console.log('⚠️ No file selected for logo');
      }

      console.log('💾 Saving business with logoUrl:', logoUrl);
      
      const docRef = await this.businessService.addBusiness({
        ownerUid: businessOwner.uid,
        businessName: formValue.businessName,
        address: formValue.address,
        phoneNumber: formValue.phoneNumber,
        description: formValue.description || 'ברוכים הבאים! כאן תמצאו את השירותים המובילים שלנו, הכירו את הצוות המקצועי שלנו וקראו מה לקוחות מרוצים חושבים עלינו.',
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
      
      console.log('✅ Business created with ID:', companyId);
      console.log('📊 Business logoUrl saved:', logoUrl);

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
      console.log('📝 Updating Firestore document with business:', business);
      console.log('🔗 logoUrl being saved to Firestore:', business.logoUrl);
      
      await setDoc(businessRef, business, { merge: true });
      
      console.log('✅ Firestore document updated successfully!');

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
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      
      let errorMessage = 'אירעה שגיאה בהרשמה.';
      
      if (error.message?.includes('חריגת זמן')) {
        errorMessage = 'העלאת הלוגו לוקחת יותר מדי זמן. נסה תמונה קטנה יותר.';
      } else if (error.code === 'storage/unauthorized') {
        errorMessage = 'אין הרשאה להעלאת קבצים. אנא התחבר מחדש.';
      } else if (error.code === 'storage/canceled') {
        errorMessage = 'העלאת הקובץ בוטלה.';
      } else if (error.code === 'storage/unknown') {
        errorMessage = 'שגיאה לא ידועה בהעלאת התמונה. בדוק את החיבור לאינטרנט.';
      } else if (error.message) {
        errorMessage = `שגיאה: ${error.message}`;
      }
      
      this.errorMsg = errorMessage;
      this.successMsg = '';
      this.toastr.error(errorMessage);
    } finally {
      this.loading = false;
    }
  }
}

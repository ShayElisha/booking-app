import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import {
  Auth,
  createUserWithEmailAndPassword,
  updateProfile,
} from '@angular/fire/auth';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  loading = false;
  error = '';
  showPassword = false;

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phoneNumber: ['', [Validators.pattern(/^05\d{8}$/)]],
    role: [''],
    termsAccepted: [false, [Validators.requiredTrue]],
    secretKey: [''], // Hidden field for admin registration
  });

  constructor(
    private fb: FormBuilder,
    private auth: Auth,
    private router: Router,
    private route: ActivatedRoute,
    private userService: UserService
  ) {
    // Check URL for adminKey parameter and apply conditional validation
    this.route.queryParams.subscribe((params) => {
      const adminKey = params['adminKey'];
      if (adminKey) {
        this.form.patchValue({ secretKey: adminKey, role: 'admin' });
        this.form.get('role')?.clearValidators(); // Remove validators if secretKey exists
      } else {
        this.form.get('role')?.setValidators([Validators.required]); // Require role if no secretKey
      }
      this.form.get('role')?.updateValueAndValidity();
    });
  }

  async register() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const {
      fullName,
      email,
      password,
      phoneNumber,
      role,
      termsAccepted,
      secretKey,
    } = this.form.value;

    const validSecretKey = 'ADMIN_SECRET_2025'; // Store securely in environment or server
    const finalRole =
      secretKey === validSecretKey
        ? 'admin'
        : (role as 'business' | 'customer') || 'admin';

    try {
      const res = await createUserWithEmailAndPassword(
        this.auth,
        email!,
        password!
      );
      await updateProfile(res.user, { displayName: fullName! });
      await this.userService.saveUserToFirestore({
        uid: res.user.uid,
        fullName: fullName!,
        email: email!,
        phoneNumber: phoneNumber || '',
        role: finalRole,
        createdAt: new Date(),
        termsAccepted: termsAccepted!,
      });
      if (finalRole === 'business') {
        localStorage.setItem(
          'business',
          JSON.stringify({
            uid: res.user.uid,
            fullName: fullName!,
            email: email!,
            phoneNumber: phoneNumber || '',
            role: finalRole,
            createdAt: new Date(),
            termsAccepted: termsAccepted!,
          })
        );
        this.router.navigate(['/register-business']);
      } else {
        this.router.navigate(['/']);
      }
    } catch (err: any) {
      this.error = this.firebaseErrorMsg(err.code);
    }
    this.loading = false;
  }


  firebaseErrorMsg(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'האימייל כבר בשימוש';
      case 'auth/invalid-email':
        return 'כתובת אימייל לא חוקית';
      case 'auth/weak-password':
        return 'הסיסמה חלשה (לפחות 6 תווים)';
      default:
        return 'שגיאה לא ידועה. נסה שוב.';
    }
  }
}

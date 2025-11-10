import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import {
  Auth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from '@angular/fire/auth';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { getDoc, doc, Firestore } from '@angular/fire/firestore';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  loading = false;
  error = '';
  showPassword = false;
  showForgotPasswordModal = false;
  resetEmail = '';

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor(
    private fb: FormBuilder,
    private auth: Auth,
    private router: Router,
    private toastr: ToastrService,
    private firestore: Firestore
  ) {}

  async login() {
    if (this.form.invalid) {
      console.log('Form invalid');
      return;
    }
    this.loading = true;
    this.error = '';
    const { email, password } = this.form.value;
    console.log('Attempting login with:', email);
    try {
      const userCredential = await signInWithEmailAndPassword(
        this.auth,
        email!,
        password!
      );
      const user = userCredential.user;
      console.log('Login successful, UID:', user.uid);
      const token = await this.generateUserToken(user);
      localStorage.setItem('userToken', token);
      this.toastr.success('התחברת בהצלחה!');
      console.log('Calling redirectUser');
      await this.redirectUser(user.uid);
    } catch (err: any) {
      console.log('Login error:', err);
      this.error = this.firebaseErrorMsg(err.code);
      this.toastr.error(this.error);
    }
    this.loading = false;
  }


  async generateUserToken(user: any): Promise<string> {
    const userDoc = await getDoc(doc(this.firestore, 'users', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const payload = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      ...userData,
      createdAt: new Date().toISOString(),
    };
    const encodedPayload = encodeURIComponent(JSON.stringify(payload));
    const token = btoa(encodedPayload);
    return token;
  }

  async redirectUser(uid: string) {
    console.log('🔍 redirectUser called with UID:', uid);
    
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', uid));
      console.log('📄 User document exists:', userDoc.exists());
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('👤 User data:', userData);
        console.log('🎭 User role:', userData['role']);
        
        const role = userData['role'];
        const companyId = userData['companyId'];
        
        console.log('📋 Redirect info:', { role, companyId });
        
        switch (role) {
          case 'admin':
            console.log('➡️ Navigating to admin-panel');
            this.router.navigate(['/admin-panel']);
            break;
          case 'business':
            console.log('➡️ Navigating to business-panel');
            // Save business info to localStorage for business panel
            if (companyId) {
              localStorage.setItem('business', JSON.stringify({
                uid: uid,
                companyId: companyId,
                role: 'business',
                ...userData
              }));
            }
            this.router.navigate(['/business-panel']);
            break;
          case 'customer':
            console.log('➡️ Navigating to customer profile');
            this.router.navigate(['/cus']);
            break;
          default:
            console.log('⚠️ Unknown role, navigating to home');
            this.router.navigate(['/']);
        }
      } else {
        console.error('❌ User document does not exist in Firestore!');
        this.toastr.error('לא נמצא תפקיד עבור המשתמש.');
        this.router.navigate(['/']);
      }
    } catch (error) {
      console.error('❌ Error in redirectUser:', error);
      this.toastr.error('שגיאה בטעינת נתוני משתמש.');
      this.router.navigate(['/']);
    }
  }

  firebaseErrorMsg(code: string): string {
    switch (code) {
      case 'auth/wrong-password':
        return 'סיסמה שגויה.';
      case 'auth/user-not-found':
        return 'משתמש לא נמצא.';
      case 'auth/invalid-email':
        return 'אימייל לא תקין.';
      case 'auth/invalid-credential':
        return 'פרטי התחברות שגויים.';
      default:
        return 'שגיאה לא ידועה. נסה שוב.';
    }
  }

  openForgotPassword(): void {
    this.showForgotPasswordModal = true;
    this.resetEmail = this.form.get('email')?.value || '';
    document.body.classList.add('modal-open');
  }

  closeForgotPassword(): void {
    this.showForgotPasswordModal = false;
    this.resetEmail = '';
    document.body.classList.remove('modal-open');
  }

  async sendPasswordReset(): Promise<void> {
    if (!this.resetEmail || !this.resetEmail.includes('@')) {
      this.toastr.error('נא להזין אימייל תקין');
      return;
    }

    this.loading = true;
    
    try {
      await sendPasswordResetEmail(this.auth, this.resetEmail);
      this.toastr.success('קישור לאיפוס סיסמה נשלח למייל!');
      this.closeForgotPassword();
    } catch (err: any) {
      console.error('Error sending password reset:', err);
      if (err.code === 'auth/user-not-found') {
        this.toastr.error('המייל לא נמצא במערכת');
      } else {
        this.toastr.error('שגיאה בשליחת קישור לאיפוס סיסמה');
      }
    } finally {
      this.loading = false;
    }
  }
}

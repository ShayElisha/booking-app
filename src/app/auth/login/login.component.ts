import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import {
  Auth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
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

  async loginWithGoogle() {
    this.loading = true;
    this.error = '';
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(this.auth, provider);
      const user = userCredential.user;
      const token = await this.generateUserToken(user);
      localStorage.setItem('userToken', token);
      this.toastr.success('התחברת בהצלחה עם Google!');
      await this.redirectUser(user.uid);
    } catch (err: any) {
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
    console.log('UID:', uid);
    const userDoc = await getDoc(doc(this.firestore, 'users', uid));
    console.log('Doc exists:', userDoc.exists());
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('User data:', userData, 'Role:', userData['role']);
      const role = userData['role'];
      const companyId = userData['companyId'] || 'default';
      switch (role) {
        case 'admin':
          console.log('Navigating to admin-panel');
          this.router.navigate(['/admin-panel']);
          break;
        case 'business':
          console.log('Navigating to business-panel');
          this.router.navigate([`/business-panel`]);
          break;
        case 'customer':
          console.log('Navigating to search');
          this.router.navigate([`/search`]);
          break;
        default:
          console.log('Navigating to default');
          this.router.navigate(['/']);
      }
    } else {
      this.toastr.error('לא נמצא תפקיד עבור המשתמש.');
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
      default:
        return 'שגיאה לא ידועה. נסה שוב.';
    }
  }
}

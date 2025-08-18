import { Component, OnInit, OnDestroy } from '@angular/core';
import { Auth, onAuthStateChanged, signOut, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  user: User | null = null;
  fullName: string = '';
  private authUnsubscribe: (() => void) | null = null; // שינוי לטיפוס פונקציה

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.authUnsubscribe = onAuthStateChanged(
      this.auth,
      async (user: User | null) => {
        this.user = user;
        if (user) {
          try {
            const userRef = doc(this.firestore, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              this.fullName = userData['fullName'] || 'משתמש';
            } else {
              this.fullName = 'משתמש';
            }
          } catch (err) {
            this.toastr.error('שגיאה בטעינת פרטי המשתמש');
            this.fullName = 'משתמש';
          }
        } else {
          this.fullName = '';
        }
      }
    );
  }

  async logout() {
    try {
      await signOut(this.auth);
      this.toastr.success('התנתקת בהצלחה');
      this.router.navigate(['/']);
    } catch (err) {
      this.toastr.error('שגיאה בעת ההתנתקות');
    }
  }

  ngOnDestroy() {
    if (this.authUnsubscribe) {
      this.authUnsubscribe(); // קריאה לפונקציית הביטול
    }
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Auth, onAuthStateChanged, signOut, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  user: User | null = null;
  fullName: string = '';
  userRole: string = '';
  photoURL: string = '';
  navLinks: NavLink[] = [];
  private authUnsubscribe: (() => void) | null = null;

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
    private toastr: ToastrService
  ) {
    // Initialize with default guest links
    this.updateNavLinks();
  }

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
              this.userRole = userData['role'] || '';
              this.photoURL = userData['photoURL'] || '';
            } else {
              this.fullName = 'משתמש';
              this.userRole = '';
              this.photoURL = '';
            }
          } catch (err) {
            console.error('Error loading user data:', err);
            this.fullName = 'משתמש';
            this.userRole = '';
            this.photoURL = '';
          }
        } else {
          this.fullName = '';
          this.userRole = '';
          this.photoURL = '';
        }
        // Update navigation links based on user role
        this.updateNavLinks();
      }
    );
  }

  updateNavLinks(): void {
    if (!this.user) {
      // Guest user - not logged in
      this.navLinks = [
        { path: '/', label: 'דף הבית', icon: '' },
        { path: '/search', label: 'חיפוש עסקים', icon: '' },
      ];
    } else if (this.userRole === 'customer') {
      // Customer links - ללא דף הבית
      this.navLinks = [
        { path: '/cus', label: 'הפרופיל שלי', icon: '' },
        { path: '/search', label: 'חיפוש עסקים', icon: '' },
      ];
    } else if (this.userRole === 'business') {
      // Business links - ללא דף הבית
      this.navLinks = [
        { path: '/business-panel', label: 'פאנל העסק', icon: '' },
        { path: '/business-panel/listQueue', label: 'רשימת תורים', icon: '' },
      ];
    } else if (this.userRole === 'admin') {
      // Admin links
      this.navLinks = [
        { path: '/', label: 'דף הבית', icon: '' },
        { path: '/admin-panel', label: 'ניהול מערכת', icon: '' },
        { path: '/search', label: 'עסקים', icon: '' },
      ];
    } else {
      // Default fallback - logged in but role not loaded yet
      this.navLinks = [];
    }
  }

  get userTypeLabel(): string {
    const labels: { [key: string]: string } = {
      'customer': 'לקוח',
      'business': 'בעל עסק',
      'admin': 'מנהל'
    };
    return labels[this.userRole] || '';
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
      this.authUnsubscribe();
    }
  }
}

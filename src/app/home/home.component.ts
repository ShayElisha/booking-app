import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { onAuthStateChanged, User } from '@angular/fire/auth';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Auto-redirect based on user role when logged in
    onAuthStateChanged(this.userService.auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        try {
          const result = await this.userService.getUserProfile(firebaseUser.uid).toPromise();
          const userData = result || null;
          
          if (userData) {
            // Redirect based on role
            if (userData.role === 'customer') {
              this.router.navigate(['/cus']);
            } else if (userData.role === 'business') {
              this.router.navigate(['/business-panel']);
            } else if (userData.role === 'admin') {
              this.router.navigate(['/admin-panel']);
            }
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      }
    });
  }
}

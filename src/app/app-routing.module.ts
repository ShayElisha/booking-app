import { BusinessProfileComponent } from './business/business-profile/business-profile.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { RegisterBusinessComponent } from './business/register-business/register-business.component';
import { AdminPanelComponent } from './admin-panel/admin-panel.component';
import { SearchComponent } from './search/search.component';
import { AppointmentListComponent } from './business/appointment-list/appointment-list.component';
import { CustomerProfileComponent } from './customer-profile/customer-profile.component';


const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'register-business', component: RegisterBusinessComponent },
  { path: 'admin-panel', component: AdminPanelComponent },
  { path: 'business-panel', component: BusinessProfileComponent },
  { path: 'business-panel/listQueue', component: AppointmentListComponent },
  { path: 'business/:id', component: BusinessProfileComponent },
  { path: 'search', component: SearchComponent },
  { path: 'cus', component: CustomerProfileComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}

import { Component, OnInit } from '@angular/core';
import { BusinessService } from '../services/business.service';
import { AppBusiness } from '../models/app-business';

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss'],
})
export class AdminPanelComponent implements OnInit {
  businesses: AppBusiness[] = [];
  loading = false;
  error = '';

  constructor(private businessService: BusinessService) {}

  ngOnInit() {
    this.loading = true;
    this.businessService.getBusinesses().subscribe({
      next: (businesses) => {
        this.businesses = businesses;
        this.loading = false;
      },
      error: () => {
        this.error = 'שגיאה בטעינת העסקים. נסה שוב.';
        this.loading = false;
      },
    });
  }

  getOpeningHours(business: AppBusiness): string {
    return (
      business.openingHours
        ?.map((hour) => `${hour.day}: ${hour.from}-${hour.to}`)
        .join(', ') || 'ללא שעות'
    );
  }
}

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
  fallbackImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCBmaWxsPSIjZGRkIiB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIvPjx0ZXh0IGZpbGw9IiM5OTkiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPteb15Ig16rXntW616DXlDwvdGV4dD48L3N2Zz4=';

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

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.src !== this.fallbackImage) {
      img.src = this.fallbackImage;
      img.onerror = null; // Prevent infinite loop
    }
  }
}

import { Component, OnInit } from '@angular/core';
import { BusinessService } from '../services/business.service';
import { AppBusiness } from '../models/app-business';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent implements OnInit {
  businesses: AppBusiness[] = [];
  filteredBusinesses: AppBusiness[] = [];
  searchForm: FormGroup;
  loading = false;
  error = '';
  fallbackImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCBmaWxsPSIjZGRkIiB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIvPjx0ZXh0IGZpbGw9IiM5OTkiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPteb15Ig16rXntW616DXlDwvdGV4dD48L3N2Zz4=';

  constructor(
    private businessService: BusinessService,
    private fb: FormBuilder
  ) {
    this.searchForm = this.fb.group({
      searchTerm: [''],
    });
  }

  ngOnInit() {
    this.loadBusinesses();
    this.searchForm.get('searchTerm')?.valueChanges.subscribe((term) => {
      this.filterBusinesses(term);
    });
  }

  loadBusinesses() {
    this.loading = true;
    this.businessService.getBusinesses().subscribe({
      next: (businesses) => {
        this.businesses = businesses;
        this.filteredBusinesses = businesses;
        this.loading = false;
      },
      error: () => {
        this.error = 'שגיאה בטעינת העסקים. נסה שוב.';
        this.loading = false;
      },
    });
  }

  filterBusinesses(term: string) {
    if (!term) {
      this.filteredBusinesses = this.businesses;
      return;
    }
    term = term.toLowerCase();
    this.filteredBusinesses = this.businesses.filter(
      (business) =>
        business.businessName.toLowerCase().includes(term) ||
        business.address.toLowerCase().includes(term) ||
        (business.description &&
          business.description.toLowerCase().includes(term))
    );
  }

  clearSearch(): void {
    this.searchForm.patchValue({ searchTerm: '' });
    this.filteredBusinesses = this.businesses;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.src !== this.fallbackImage) {
      img.src = this.fallbackImage;
      img.onerror = null; // Prevent infinite loop
    }
  }
}

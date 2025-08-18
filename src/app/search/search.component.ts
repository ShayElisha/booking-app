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
}

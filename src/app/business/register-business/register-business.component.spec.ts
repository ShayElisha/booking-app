import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegisterBusinessComponent } from './register-business.component';

describe('RegisterBusinessComponent', () => {
  let component: RegisterBusinessComponent;
  let fixture: ComponentFixture<RegisterBusinessComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RegisterBusinessComponent]
    });
    fixture = TestBed.createComponent(RegisterBusinessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

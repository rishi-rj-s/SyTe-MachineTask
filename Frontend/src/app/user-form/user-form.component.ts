import { AngularSignaturePadModule, SignaturePadComponent } from '@almothafar/angular-signature-pad';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule,
    AngularSignaturePadModule
],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.css'
})
export class UserFormComponent implements OnInit {

  userForm: FormGroup;
  predictedAge: number | null = null;
  countries = ['USA', 'INDIA', 'CANADA'];
  states: string[] = [];
  cities: string[] = [];
  occupations = ['Student', 'Engineer', 'Doctor', 'Other'];

  @ViewChild('pad') signaturePad!: SignaturePadComponent;


  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    this.userForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      dob: ['', [Validators.required, this.ageValidator(18)]],
      gender: ['', Validators.required],
      address1: ['', [Validators.required, Validators.maxLength(100)]],
      address2: ['', Validators.maxLength(100)],
      country: ['', Validators.required],
      state: ['', Validators.required],
      city: ['', Validators.required],
      zipCode: ['', [Validators.required, Validators.pattern(/^[0-9]{5,6}$/)]],
      occupation: ['', Validators.required],
      income: ['', [Validators.min(0)]],
      signature: ['', Validators.required]
    })
  }

  ngOnInit(): void {
    this.userForm.get('fullName')?.valueChanges
      .pipe(
        debounceTime(1000),
        distinctUntilChanged(),
        switchMap(name => this.http.get(`https://api.agify.io/?name=${name}`))
      )
      .subscribe((res: any) => {
        this.predictedAge = res.age;
      });

    this.userForm.get('country')?.valueChanges.subscribe(country => {
      this.updateStates(country);
      this.userForm.get('state')?.reset();
      this.userForm.get('city')?.reset();
    });

    this.userForm.get('state')?.valueChanges.subscribe(state => {
      this.updateCities(state);
      this.userForm.get('city')?.reset();
    });
  }

  ageValidator(minAge: number) {
    return (control: any) => {
      const dob = new Date(control.value);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      return age >= minAge ? null : { underAge: true }
    }
  }

  updateStates(country: string) {
    const stateMap: Record<string, string[]> = {
      'USA': ['California', 'Texas', 'New York'],
      'INDIA': ['Maharashtra', 'Karnataka', 'Delhi'],
      'CANADA': ['Ontario', 'Quebec', 'British Columbia']
    };
    this.states = stateMap[country] || [];
  }

  updateCities(state: string) {
    const cityMap: Record<string, string[]> = {
      'California': ['Los Angeles', 'San Francisco', 'San Diego'],
      'Texas': ['Houston', 'Austin', 'Dallas'],
      'New York': ['New York City', 'Buffalo', 'Rochester'],
      'Maharashtra': ['Mumbai', 'Pune', 'Nagpur'],
      'Karnataka': ['Bangalore', 'Mysore', 'Mangalore'],
      'Delhi': ['New Delhi', 'Noida', 'Gurgaon'],
      'Ontario': ['Toronto', 'Ottawa', 'Hamilton'],
      'Quebec': ['Montreal', 'Quebec City', 'Laval'],
      'British Columbia': ['Vancouver', 'Victoria', 'Kelowna']
    };
    this.cities = cityMap[state] || [];
  }

  onSubmit(): void {
    if (this.userForm.valid) {
      const formData = this.userForm.value;
      formData.age = this.predictedAge;
      console.log('Form submitted:', formData);

      this.http.post('http://localhost:3000/api/user', formData, {
        responseType: 'blob'
      }).subscribe({
        next: (pdfBlob: Blob) => {
          // PDF download logic
          const url = window.URL.createObjectURL(pdfBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'user_details.pdf';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          console.log('PDF downloaded successfully');
        },
        error: (err) => {
          console.error('Form submission error:', err);
        }
      });
    } else {
      this.userForm.markAllAsTouched();
      console.warn('Form invalid - please complete all required fields');
    }
  }

  onSignatureSave(): void {
    if (this.signaturePad?.isEmpty()) {
      this.userForm.get('signature')?.setValue('');
    } else {
      const dataUrl = this.signaturePad.toDataURL();
      this.userForm.get('signature')?.setValue(dataUrl);
    }
  }

  clearSignature(): void {
    this.signaturePad.clear();
    const control = this.userForm.get('signature');
    control?.setValue('');
    control?.markAsTouched();
  }

  onSignatureClear() : void {
    this.userForm.get('signature')?.setValue('');
  }

}
import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
} from '@angular/fire/firestore';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import { Employee } from '../models/employee'; // Adjust path to your Employee interface

@Injectable({
  providedIn: 'root',
})
export class EmployeeService {
  constructor(private firestore: Firestore) {}

  // Create: Add a new employee
  async addEmployee(employee: Employee): Promise<void> {
    try {
      if (!employee.companyId) {
        throw new Error('Company ID is required');
      }
      const employeeRef = collection(
        this.firestore,
        `businesses/${employee.companyId}/employees`
      );
      const newEmployeeRef = doc(employeeRef);
      const timestamp = new Date().toISOString();
      await setDoc(newEmployeeRef, {
        ...employee,
        id: newEmployeeRef.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    } catch (error) {
      throw new Error(`Error adding employee: ${error}`);
    }
  }

  // Read: Get a single employee by ID
  getEmployee(companyId: string, employeeId: string): Observable<Employee> {
    const employeeRef = doc(
      this.firestore,
      `businesses/${companyId}/employees/${employeeId}`
    );
    return from(getDoc(employeeRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as Employee;
        }
        throw new Error('Employee not found');
      }),
      catchError((error) =>
        throwError(() => new Error(`Error fetching employee: ${error}`))
      )
    );
  }

  // Read: Get all employees for a company
  getEmployeesByCompanyId(companyId: string): Observable<Employee[]> {
    const employeesRef = collection(
      this.firestore,
      `businesses/${companyId}/employees`
    );
    return from(getDocs(employeesRef)).pipe(
      map((querySnapshot) => {
        const employees: Employee[] = [];
        querySnapshot.forEach((doc) => {
          employees.push({ id: doc.id, ...doc.data() } as Employee);
        });
        return employees;
      }),
      catchError((error) =>
        throwError(() => new Error(`Error fetching employees: ${error}`))
      )
    );
  }

  // Update: Modify an existing employee
  async updateEmployee(
    companyId: string,
    employeeId: string,
    updatedData: Partial<Employee>
  ): Promise<void> {
    try {
      const employeeRef = doc(
        this.firestore,
        `businesses/${companyId}/employees/${employeeId}`
      );
      const timestamp = new Date().toISOString();
      await updateDoc(employeeRef, {
        ...updatedData,
        updatedAt: timestamp,
      });
    } catch (error) {
      throw new Error(`Error updating employee: ${error}`);
    }
  }

  // Delete: Remove an employee
  async deleteEmployee(companyId: string, employeeId: string): Promise<void> {
    try {
      const employeeRef = doc(
        this.firestore,
        `businesses/${companyId}/employees/${employeeId}`
      );
      await deleteDoc(employeeRef);
    } catch (error) {
      throw new Error(`Error deleting employee: ${error}`);
    }
  }
}

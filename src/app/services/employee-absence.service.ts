import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { EmployeeAbsence } from '../models/employee-absence';

@Injectable({
  providedIn: 'root',
})
export class EmployeeAbsenceService {
  constructor(private firestore: Firestore) {}

  /**
   * Add a new absence record
   */
  async addAbsence(
    companyId: string,
    absence: Partial<EmployeeAbsence>
  ): Promise<string> {
    const absencesRef = collection(
      this.firestore,
      `businesses/${companyId}/employeeAbsences`
    );
    const docRef = await addDoc(absencesRef, {
      ...absence,
      createdAt: new Date().toISOString(),
      status: absence.status || 'pending',
    });
    return docRef.id;
  }

  /**
   * Update absence status (approve/reject)
   */
  async updateAbsenceStatus(
    companyId: string,
    absenceId: string,
    status: 'approved' | 'rejected',
    managerUid: string
  ): Promise<void> {
    const absenceRef = doc(
      this.firestore,
      `businesses/${companyId}/employeeAbsences/${absenceId}`
    );
    await updateDoc(absenceRef, {
      status,
      approvedBy: managerUid,
      approvedAt: new Date().toISOString(),
    });
  }

  /**
   * Update an existing absence
   */
  async updateAbsence(
    companyId: string,
    absenceId: string,
    data: Partial<EmployeeAbsence>
  ): Promise<void> {
    const absenceRef = doc(
      this.firestore,
      `businesses/${companyId}/employeeAbsences/${absenceId}`
    );
    await updateDoc(absenceRef, data);
  }

  /**
   * Delete an absence record
   */
  async deleteAbsence(companyId: string, absenceId: string): Promise<void> {
    const absenceRef = doc(
      this.firestore,
      `businesses/${companyId}/employeeAbsences/${absenceId}`
    );
    await deleteDoc(absenceRef);
  }

  /**
   * Get all absences for a specific employee
   */
  async getEmployeeAbsences(
    companyId: string,
    employeeId: string
  ): Promise<EmployeeAbsence[]> {
    const absencesRef = collection(
      this.firestore,
      `businesses/${companyId}/employeeAbsences`
    );
    const q = query(absencesRef, where('employeeId', '==', employeeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as EmployeeAbsence)
    );
  }

  /**
   * Get all absences for a company
   */
  async getAllAbsences(companyId: string): Promise<EmployeeAbsence[]> {
    const absencesRef = collection(
      this.firestore,
      `businesses/${companyId}/employeeAbsences`
    );
    const snapshot = await getDocs(absencesRef);
    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as EmployeeAbsence)
    );
  }

  /**
   * Check if an employee is absent on a specific date
   */
  isEmployeeAbsent(
    absences: EmployeeAbsence[],
    employeeId: string,
    date: string
  ): boolean {
    return absences.some(
      (absence) =>
        absence.employeeId === employeeId &&
        absence.status === 'approved' &&
        date >= absence.startDate &&
        date <= absence.endDate
    );
  }

  /**
   * Get absences for a specific date range
   */
  getAbsencesInRange(
    absences: EmployeeAbsence[],
    startDate: string,
    endDate: string
  ): EmployeeAbsence[] {
    return absences.filter(
      (absence) =>
        absence.status === 'approved' &&
        ((absence.startDate >= startDate && absence.startDate <= endDate) ||
          (absence.endDate >= startDate && absence.endDate <= endDate) ||
          (absence.startDate <= startDate && absence.endDate >= endDate))
    );
  }

  /**
   * Get pending absences that require approval
   */
  getPendingAbsences(absences: EmployeeAbsence[]): EmployeeAbsence[] {
    return absences.filter((absence) => absence.status === 'pending');
  }
}


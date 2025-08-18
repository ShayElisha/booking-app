import { Pipe, PipeTransform } from '@angular/core';
import { Employee } from '../models/employee';

@Pipe({
  name: 'filterEmployeesByService',
})
export class FilterEmployeesByServicePipe implements PipeTransform {
  transform(employees: Employee[], serviceId: string | undefined): Employee[] {
    if (!employees || !serviceId) return employees;
    return employees.filter((employee) =>
      employee.services?.includes(serviceId)
    );
  }
}

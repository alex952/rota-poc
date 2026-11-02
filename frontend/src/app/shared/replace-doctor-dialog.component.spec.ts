import { TestBed } from '@angular/core/testing';
import { ReplaceDoctorDialogComponent } from './replace-doctor-dialog.component';

describe('ReplaceDoctorDialogComponent', () => {
  function createDialog() {
    TestBed.configureTestingModule({ imports: [ReplaceDoctorDialogComponent] });
    const fixture = TestBed.createComponent(ReplaceDoctorDialogComponent);
    fixture.componentRef.setInput('date', '15 de marzo');
    fixture.componentRef.setInput('doctorName', 'Dr. Navarro');
    fixture.componentRef.setInput('doctors', [
      { doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' },
      { doctor_id: 'doc-002', doctor_name: 'Dr. Lopez' },
    ]);
    fixture.detectChanges();
    return fixture;
  }

  it('pinta el botón de añadir y un botón de sustitución por médico', () => {
    const el: HTMLElement = createDialog().nativeElement;

    const addBtn = el.querySelector('[data-testid="add-doctor-option"]');
    expect(addBtn?.textContent?.trim()).toBe('Añadir a la guardia');

    const replaceBtns = el.querySelectorAll('.btn-doctor');
    expect(Array.from(replaceBtns).map((b) => b.textContent?.trim())).toEqual([
      'Sustituir a Dr. Garcia',
      'Sustituir a Dr. Lopez',
    ]);
  });

  it('usa la etiqueta de añadir recibida y marca los refuerzos', () => {
    const fixture = createDialog();
    fixture.componentRef.setInput('addLabel', 'Añadir como refuerzo');
    fixture.componentRef.setInput('doctors', [
      { doctor_id: 'doc-011', doctor_name: 'Dr. Navarro', role: 'guardia' },
      { doctor_id: 'doc-012', doctor_name: 'Dr. Torres', role: 'refuerzo' },
    ]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('[data-testid="add-doctor-option"]')?.textContent?.trim()).toBe(
      'Añadir como refuerzo',
    );
    expect(Array.from(el.querySelectorAll('.btn-doctor')).map((b) => b.textContent?.trim())).toEqual([
      'Sustituir a Dr. Navarro',
      'Sustituir a Dr. Torres (refuerzo)',
    ]);
  });

  it('emite added al pulsar Añadir', () => {
    const fixture = createDialog();
    let added = 0;
    fixture.componentInstance.added.subscribe(() => added++);

    fixture.nativeElement.querySelector('[data-testid="add-doctor-option"]').click();

    expect(added).toBe(1);
  });

  it('emite selected con el médico elegido', () => {
    const fixture = createDialog();
    const choices: unknown[] = [];
    fixture.componentInstance.selected.subscribe((c) => choices.push(c));

    fixture.nativeElement.querySelectorAll('.btn-doctor')[1].click();

    expect(choices).toEqual([{ doctor_id: 'doc-002', doctor_name: 'Dr. Lopez' }]);
  });

  it('emite cancelled al pulsar Cancelar', () => {
    const fixture = createDialog();
    let cancelled = 0;
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);

    fixture.nativeElement.querySelector('.btn-cancel').click();

    expect(cancelled).toBe(1);
  });
});

import { TestBed } from '@angular/core/testing';
import { ReplaceDoctorDialogComponent } from './replace-doctor-dialog.component';

describe('ReplaceDoctorDialogComponent', () => {
  const garcia = { doctor_id: 'doc-001', doctor_name: 'Dr. Garcia', role: 'guardia' as const };
  const lopez = { doctor_id: 'doc-002', doctor_name: 'Dr. Lopez', role: 'refuerzo' as const };
  const ruiz = { doctor_id: 'doc-003', doctor_name: 'Dr. Ruiz', role: 'refuerzo' as const };

  function createDialog() {
    TestBed.configureTestingModule({ imports: [ReplaceDoctorDialogComponent] });
    const fixture = TestBed.createComponent(ReplaceDoctorDialogComponent);
    fixture.componentRef.setInput('date', '15 de marzo');
    fixture.componentRef.setInput('doctorName', 'Dr. Navarro');
    fixture.componentRef.setInput('rotaType', 'AC');
    fixture.componentRef.setInput('guardia', garcia);
    fixture.componentRef.setInput('refuerzos', [
      { doctor: lopez, rotaType: 'AP' },
      { doctor: ruiz, rotaType: 'AC' },
    ]);
    fixture.detectChanges();
    return fixture;
  }

  const texts = (el: HTMLElement, selector: string) =>
    Array.from(el.querySelectorAll(selector)).map((b) => b.textContent?.trim());

  it('ofrece, en orden, sustituir la guardia, sustituir cada refuerzo y añadir al refuerzo', () => {
    const el: HTMLElement = createDialog().nativeElement;

    expect(texts(el, 'button:not(.btn-cancel)')).toEqual([
      'Sustituir a Dr. Garcia en la guardia AC',
      'Sustituir a Dr. Lopez en el refuerzo',
      'Sustituir a Dr. Ruiz (AC) en el refuerzo',
      'Añadir al refuerzo',
    ]);
  });

  it('sin guardia sustituible no ofrece esa opción', () => {
    const fixture = createDialog();
    fixture.componentRef.setInput('guardia', null);
    fixture.componentRef.setInput('refuerzos', []);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('[data-testid="replace-guardia-option"]')).toBeNull();
    expect(texts(el, 'button:not(.btn-cancel)')).toEqual(['Añadir al refuerzo']);
  });

  it('emite added al pulsar Añadir al refuerzo', () => {
    const fixture = createDialog();
    let added = 0;
    fixture.componentInstance.added.subscribe(() => added++);

    fixture.nativeElement.querySelector('[data-testid="add-doctor-option"]').click();

    expect(added).toBe(1);
  });

  it('emite selected con el médico y su grupo', () => {
    const fixture = createDialog();
    const choices: unknown[] = [];
    fixture.componentInstance.selected.subscribe((c) => choices.push(c));

    fixture.nativeElement.querySelector('[data-testid="replace-guardia-option"]').click();
    fixture.nativeElement.querySelectorAll('[data-testid="replace-refuerzo-option"]')[0].click();

    expect(choices).toEqual([
      { doctor_id: 'doc-001', doctor_name: 'Dr. Garcia', rota_type: 'AC' },
      { doctor_id: 'doc-002', doctor_name: 'Dr. Lopez', rota_type: 'AP' },
    ]);
  });

  it('emite cancelled al pulsar Cancelar', () => {
    const fixture = createDialog();
    let cancelled = 0;
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);

    fixture.nativeElement.querySelector('.btn-cancel').click();

    expect(cancelled).toBe(1);
  });
});

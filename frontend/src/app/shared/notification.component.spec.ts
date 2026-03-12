import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationComponent } from './notification.component';
import { NotificationService } from '../core/services/notification.service';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';

describe('NotificationComponent', () => {
  let fixture: ComponentFixture<NotificationComponent>;
  let service: NotificationService;

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [NotificationComponent],
    }).compileComponents();

    service = TestBed.inject(NotificationService);
    fixture = TestBed.createComponent(NotificationComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should display error message', () => {
    service.show('Something went wrong', 'error');
    fixture.detectChanges();

    const notification = fixture.nativeElement.querySelector('.notification-error');
    expect(notification).toBeTruthy();
    expect(notification.textContent).toContain('Something went wrong');
  });

  it('should display success message', () => {
    service.show('Rota generated successfully', 'success');
    fixture.detectChanges();

    const notification = fixture.nativeElement.querySelector('.notification-success');
    expect(notification).toBeTruthy();
    expect(notification.textContent).toContain('Rota generated successfully');
  });

  it('should auto-dismiss after timeout', () => {
    service.setAutoDismissMs(3000);
    service.show('Temporary message', 'info');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.notification')).toBeTruthy();

    vi.advanceTimersByTime(3000);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.notification')).toBeFalsy();
  });

  it('should be closable manually', () => {
    service.show('Dismissable message', 'info');
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector('.notification-close');
    expect(closeBtn).toBeTruthy();

    closeBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.notification')).toBeFalsy();
  });
});

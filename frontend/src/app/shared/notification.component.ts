import { Component, inject } from '@angular/core';
import { NotificationService } from '../core/services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  template: `
    <div class="notification-container">
      @for (notification of notificationService.notifications(); track notification.id) {
        <div
          class="notification"
          [class.notification-error]="notification.type === 'error'"
          [class.notification-success]="notification.type === 'success'"
          [class.notification-info]="notification.type === 'info'"
          [class.notification-warning]="notification.type === 'warning'"
          role="alert"
        >
          <span class="notification-message">{{ notification.message }}</span>
          <button
            class="notification-close"
            (click)="notificationService.dismiss(notification.id)"
            aria-label="Cerrar notificación"
          >
            &times;
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
      top: 1rem;
      right: 1rem;
      z-index: 2000;
    }

    .notification-container {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 380px;
    }

    .notification {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      font-size: 0.85rem;
      line-height: 1.4;
      animation: slide-in 0.25s ease-out;
    }

    @keyframes slide-in {
      from {
        opacity: 0;
        transform: translateX(1rem);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .notification-error {
      background: #fdecea;
      color: #611a15;
      border-left: 4px solid #f44336;
    }

    .notification-success {
      background: #edf7ed;
      color: #1e4620;
      border-left: 4px solid #4caf50;
    }

    .notification-info {
      background: #e8f4fd;
      color: #0d3c61;
      border-left: 4px solid #2196f3;
    }

    .notification-warning {
      background: #fff8e1;
      color: #663c00;
      border-left: 4px solid #ff9800;
      white-space: pre-line;
    }

    .notification-message {
      flex: 1;
    }

    .notification-close {
      background: none;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
      color: inherit;
      opacity: 0.7;
      padding: 0;
      line-height: 1;
      flex-shrink: 0;
    }

    .notification-close:hover {
      opacity: 1;
    }
  `],
})
export class NotificationComponent {
  protected readonly notificationService = inject(NotificationService);
}

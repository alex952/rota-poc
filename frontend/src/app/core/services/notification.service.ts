import { Injectable, signal } from '@angular/core';

export type NotificationType = 'error' | 'success' | 'info' | 'warning';

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 0;
  private autoDismissMs = 5000;

  readonly notifications = signal<Notification[]>([]);

  show(message: string, type: NotificationType = 'info'): void {
    const id = this.nextId++;
    this.notifications.update((list) => [...list, { id, message, type }]);

    const duration = type === 'warning' ? this.autoDismissMs * 2 : this.autoDismissMs;
    setTimeout(() => this.dismiss(id), duration);
  }

  dismiss(id: number): void {
    this.notifications.update((list) => list.filter((n) => n.id !== id));
  }

  /** For testing: override the auto-dismiss timeout duration. */
  setAutoDismissMs(ms: number): void {
    this.autoDismissMs = ms;
  }
}

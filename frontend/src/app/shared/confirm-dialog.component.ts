import { Component, ElementRef, HostListener, input, output, AfterViewInit, ViewChild } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <div class="confirm-dialog-backdrop" (click)="onBackdropClick($event)">
      <div class="confirm-dialog" role="dialog" aria-modal="true">
        <h3 class="confirm-title">Confirm Re-generation</h3>
        <p class="confirm-message">{{ message() }}</p>
        <div class="confirm-actions">
          <button class="btn-cancel" (click)="cancelled.emit()">Cancel</button>
          <button class="btn-confirm" #confirmBtn (click)="confirmed.emit()">Confirm</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fade-in 0.15s ease-out;
    }

    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .confirm-dialog {
      background: white;
      padding: 1.5rem;
      border-radius: 10px;
      max-width: 440px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
      animation: scale-in 0.15s ease-out;
    }

    @keyframes scale-in {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .confirm-title {
      margin: 0 0 0.75rem;
      font-size: 1rem;
      font-weight: 700;
      color: #333;
    }

    .confirm-message {
      margin: 0 0 1.25rem;
      font-size: 0.85rem;
      color: #555;
      line-height: 1.5;
    }

    .confirm-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
    }

    .btn-cancel,
    .btn-confirm {
      padding: 0.5rem 1.25rem;
      font-size: 0.85rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .btn-cancel {
      border: 1px solid #ccc;
      background: #fff;
      color: #555;
    }

    .btn-cancel:hover {
      background: #f5f5f5;
      border-color: #aaa;
    }

    .btn-confirm {
      border: none;
      background: #c62828;
      color: #fff;
    }

    .btn-confirm:hover {
      background: #b71c1c;
    }

    .btn-confirm:focus-visible,
    .btn-cancel:focus-visible {
      outline: 2px solid #1a237e;
      outline-offset: 2px;
    }
  `],
})
export class ConfirmDialogComponent implements AfterViewInit {
  readonly message = input<string>(
    'The current rota will be replaced with a new one. This action cannot be undone. Continue?'
  );

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  @ViewChild('confirmBtn') confirmBtn!: ElementRef<HTMLButtonElement>;

  ngAfterViewInit(): void {
    // Focus the confirm button for keyboard accessibility
    this.confirmBtn?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.cancelled.emit();
  }

  @HostListener('document:keydown.enter')
  onEnterKey(): void {
    this.confirmed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('confirm-dialog-backdrop')) {
      this.cancelled.emit();
    }
  }
}

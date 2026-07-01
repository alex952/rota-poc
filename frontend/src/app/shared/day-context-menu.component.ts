import { Component, ElementRef, HostListener, input, output, ViewChild } from '@angular/core';

export interface ContextMenuAction {
  action: 'mark' | 'unmark';
  date: string;
}

@Component({
  selector: 'app-day-context-menu',
  standalone: true,
  template: `
    <div
      #menuRef
      class="context-menu"
      [style.left.px]="x()"
      [style.top.px]="y()"
      role="menu"
      tabindex="-1"
    >
      @if (canMark()) {
        <button class="menu-item" role="menuitem" (click)="onMark()">
          Marcar como festivo
        </button>
      }
      @if (canUnmark()) {
        <button class="menu-item" role="menuitem" (click)="onUnmark()">
          Desmarcar como festivo
        </button>
      }
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 900;
    }

    .context-menu {
      position: absolute;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      padding: 4px 0;
      min-width: 180px;
      animation: fade-in 0.1s ease-out;
    }

    @keyframes fade-in {
      from { opacity: 0; transform: translateY(-2px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .menu-item {
      display: block;
      width: 100%;
      padding: 8px 16px;
      border: none;
      background: none;
      text-align: left;
      font-size: 0.85rem;
      color: #333;
      cursor: pointer;
      transition: background-color 0.1s ease;
    }

    .menu-item:hover {
      background-color: #f5f5f5;
    }

    .menu-item:focus-visible {
      outline: none;
      background-color: #e3f2fd;
    }
  `],
})
export class DayContextMenuComponent {
  readonly x = input.required<number>();
  readonly y = input.required<number>();
  readonly date = input.required<string>();
  readonly dayType = input.required<string>();

  readonly actionSelected = output<ContextMenuAction>();
  readonly dismissed = output<void>();

  @ViewChild('menuRef') menuRef!: ElementRef<HTMLDivElement>;

  readonly canMark = () => this.dayType() !== 'holiday-manual';
  readonly canUnmark = () => this.dayType() === 'holiday-manual';

  onMark(): void {
    this.actionSelected.emit({ action: 'mark', date: this.date() });
  }

  onUnmark(): void {
    this.actionSelected.emit({ action: 'unmark', date: this.date() });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.menuRef?.nativeElement.contains(event.target as Node)) {
      return;
    }
    this.dismissed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dismissed.emit();
  }
}

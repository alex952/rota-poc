import { AfterViewInit, Component, ElementRef, HostListener, ViewChild, input, output, signal } from '@angular/core';

/** Diálogo para dar nombre a un equipo, al crearlo o al renombrarlo. */
@Component({
  selector: 'app-team-name-dialog',
  standalone: true,
  template: `
    <div class="dialog-backdrop" (click)="onBackdropClick($event)">
      <form class="dialog" role="dialog" aria-modal="true" (submit)="onSubmit($event)">
        <h3 class="dialog-title">{{ title() }}</h3>
        @if (hint()) {
          <p class="dialog-hint">{{ hint() }}</p>
        }
        <label class="field-label" for="team-name">Nombre del equipo</label>
        <input
          #nameInput
          id="team-name"
          class="field-input"
          type="text"
          maxlength="100"
          autocomplete="off"
          [value]="name()"
          (input)="name.set(nameInput.value)"
        />
        @if (error()) {
          <p class="field-error" role="alert">{{ error() }}</p>
        }
        <div class="dialog-actions">
          <button type="button" class="btn-cancel" (click)="cancelled.emit()">Cancelar</button>
          <button type="submit" class="btn-submit" [disabled]="!name().trim() || saving()">{{ submitLabel() }}</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .dialog {
      background: #fff;
      padding: 1.5rem;
      border-radius: 10px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    }

    .dialog-title {
      margin: 0 0 0.75rem;
      font-size: 1rem;
      font-weight: 700;
      color: #333;
    }

    .dialog-hint {
      margin: 0 0 1rem;
      font-size: 0.8rem;
      color: #666;
      line-height: 1.45;
    }

    .field-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: #555;
      margin-bottom: 0.25rem;
    }

    .field-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.5rem;
      font-size: 0.85rem;
      border: 1px solid #bbb;
      border-radius: 6px;
    }

    .field-input:focus {
      outline: none;
      border-color: #1a237e;
      box-shadow: 0 0 0 2px rgba(26, 35, 126, 0.12);
    }

    .field-error {
      margin: 0.5rem 0 0;
      font-size: 0.78rem;
      color: #c62828;
    }

    .dialog-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      margin-top: 1.25rem;
    }

    .btn-cancel,
    .btn-submit {
      padding: 0.5rem 1.25rem;
      font-size: 0.85rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
    }

    .btn-cancel {
      border: 1px solid #ccc;
      background: #fff;
      color: #555;
    }

    .btn-submit {
      border: none;
      background: #1a237e;
      color: #fff;
    }

    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `],
})
export class TeamNameDialogComponent implements AfterViewInit {
  readonly title = input.required<string>();
  readonly submitLabel = input<string>('Guardar');
  readonly hint = input<string>('');
  readonly initialName = input<string>('');
  /** Error del servidor (p. ej. nombre repetido); el diálogo sigue abierto para corregirlo */
  readonly error = input<string>('');
  readonly saving = input<boolean>(false);

  readonly saved = output<string>();
  readonly cancelled = output<void>();

  protected readonly name = signal('');

  @ViewChild('nameInput') nameInput!: ElementRef<HTMLInputElement>;

  ngAfterViewInit(): void {
    this.name.set(this.initialName());
    this.nameInput.nativeElement.value = this.initialName();
    this.nameInput.nativeElement.focus();
    this.nameInput.nativeElement.select();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.cancelled.emit();
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    const name = this.name().trim();
    if (name && !this.saving()) {
      this.saved.emit(name);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelled.emit();
    }
  }
}

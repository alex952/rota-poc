import { HttpErrorResponse } from '@angular/common/http';

/**
 * Mensaje para el usuario a partir de un error HTTP: «fallback: mensaje del backend».
 * Los mensajes del backend llegan literalmente a la interfaz, por eso están en español.
 */
export function extractErrorMessage(err: HttpErrorResponse | any, fallback: string): string {
  const backendMessage = err?.error?.message ?? err?.error?.detail;
  if (typeof backendMessage === 'string' && backendMessage.length > 0) {
    return `${fallback}: ${backendMessage}`;
  }
  if (Array.isArray(backendMessage) && backendMessage.length > 0) {
    return `${fallback}: ${backendMessage.join(', ')}`;
  }
  if (err?.message) {
    return `${fallback}: ${err.message}`;
  }
  return fallback;
}

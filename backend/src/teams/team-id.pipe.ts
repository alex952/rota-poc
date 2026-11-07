import { BadRequestException, ParseIntPipe } from '@nestjs/common';

/** `?team_id=` opcional; si falta, los servicios usan el equipo principal. */
export const OptionalTeamIdPipe = new ParseIntPipe({
  optional: true,
  exceptionFactory: () => new BadRequestException('el equipo debe ser un número entero'),
});

/** `:teamId` de la ruta. */
export const TeamIdPipe = new ParseIntPipe({
  exceptionFactory: () => new BadRequestException('el equipo debe ser un número entero'),
});

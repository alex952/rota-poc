import { EntityManager } from 'typeorm';

import { RotaAssignmentEntity } from './entities/rota-assignment.entity';
import { RotaDoctorEntity } from './entities/rota-doctor.entity';
import { RotaEntity } from './entities/rota.entity';

/** Borra un cuadrante con sus médicos y asignaciones (sql.js no aplica las FK en cascada). */
export async function deleteRotaWithChildren(manager: EntityManager, rotaId: number): Promise<void> {
  await manager.delete(RotaAssignmentEntity, { rotaId });
  await manager.delete(RotaDoctorEntity, { rotaId });
  await manager.delete(RotaEntity, { id: rotaId });
}

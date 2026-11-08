import { BadRequestException, Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { RotaEntity } from '../rota/entities/rota.entity';
import { deleteRotaWithChildren } from '../rota/rota-deletion';
import { TeamDoctorDto } from './dto/team-doctors.dto';
import { TeamEntity } from './team.entity';

/** Equipo que existe siempre: recoge los cuadrantes anteriores a los equipos. */
export const DEFAULT_TEAM_NAME = 'Equipo principal';

export interface TeamResponse {
  id: number;
  name: string;
  doctors: TeamEntity['doctors'];
}

@Injectable()
export class TeamsService implements OnApplicationBootstrap {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,
  ) {}

  /** Siempre hay al menos un equipo: si no hay ninguno, se crea el principal al arrancar. */
  async onApplicationBootstrap(): Promise<void> {
    if ((await this.teamRepository.count()) === 0) {
      await this.teamRepository.save(this.teamRepository.create({ name: DEFAULT_TEAM_NAME, doctors: [] }));
    }
  }

  /** Equipos por orden de creación. */
  async list(): Promise<TeamResponse[]> {
    const teams = await this.teamRepository.find({ order: { id: 'ASC' } });
    return teams.map((team) => this.toResponse(team));
  }

  async create(name: string): Promise<TeamResponse> {
    await this.assertNameAvailable(name);
    const team = await this.teamRepository.save(this.teamRepository.create({ name, doctors: [] }));
    return this.toResponse(team);
  }

  async rename(teamId: number, name: string): Promise<TeamResponse> {
    const team = await this.findOrFail(teamId);
    if (team.name !== name) {
      await this.assertNameAvailable(name);
      team.name = name;
      await this.teamRepository.save(team);
    }
    return this.toResponse(team);
  }

  /**
   * Sustituye la lista de médicos del equipo. Los cuadrantes ya generados conservan el grupo
   * con que se generaron hasta que se regeneren.
   */
  async setDoctors(teamId: number, doctors: TeamDoctorDto[]): Promise<TeamResponse> {
    const team = await this.findOrFail(teamId);
    const seen = new Set<string>();
    const repeated = new Set<string>();
    for (const doctor of doctors) {
      (seen.has(doctor.id) ? repeated : seen).add(doctor.id);
    }
    if (repeated.size > 0) {
      throw new BadRequestException(
        `Hay médicos con el identificador repetido: ${[...repeated].join(', ')}.`,
      );
    }
    team.doctors = doctors.map(({ id, name, department, rota_type }) => ({ id, name, department, rota_type }));
    await this.teamRepository.save(team);
    return this.toResponse(team);
  }

  /** Borra el equipo con todos sus cuadrantes. Siempre tiene que quedar uno. */
  async delete(teamId: number): Promise<void> {
    await this.findOrFail(teamId);
    if ((await this.teamRepository.count()) <= 1) {
      throw new BadRequestException('No se puede borrar el único equipo.');
    }
    await this.dataSource.transaction(async (manager) => {
      const rotas = await manager.find(RotaEntity, { where: { teamId } });
      for (const rota of rotas) {
        await deleteRotaWithChildren(manager, rota.id);
      }
      await manager.delete(TeamEntity, { id: teamId });
    });
  }

  /** Id del equipo indicado o, si se omite, del equipo principal (el más antiguo). */
  async resolveTeamId(teamId?: number): Promise<number> {
    if (teamId !== undefined) {
      return (await this.findOrFail(teamId)).id;
    }
    const [oldest] = await this.teamRepository.find({ order: { id: 'ASC' }, take: 1 });
    return oldest.id;
  }

  private async findOrFail(teamId: number): Promise<TeamEntity> {
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(`No se ha encontrado el equipo ${teamId}.`);
    }
    return team;
  }

  private async assertNameAvailable(name: string): Promise<void> {
    if (await this.teamRepository.exists({ where: { name } })) {
      throw new BadRequestException(`Ya existe un equipo llamado «${name}».`);
    }
  }

  private toResponse(team: TeamEntity): TeamResponse {
    return { id: team.id, name: team.name, doctors: team.doctors ?? [] };
  }
}

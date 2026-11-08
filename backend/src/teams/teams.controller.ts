import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';

import { TeamDoctorsDto } from './dto/team-doctors.dto';
import { TeamNameDto } from './dto/team-name.dto';
import { TeamIdPipe } from './team-id.pipe';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  list() {
    return this.teamsService.list();
  }

  @Post()
  create(@Body() request: TeamNameDto) {
    return this.teamsService.create(request.name);
  }

  @Patch(':teamId')
  rename(@Param('teamId', TeamIdPipe) teamId: number, @Body() request: TeamNameDto) {
    return this.teamsService.rename(teamId, request.name);
  }

  @Put(':teamId/doctors')
  setDoctors(@Param('teamId', TeamIdPipe) teamId: number, @Body() request: TeamDoctorsDto) {
    return this.teamsService.setDoctors(teamId, request.doctors);
  }

  @Delete(':teamId')
  @HttpCode(204)
  async delete(@Param('teamId', TeamIdPipe) teamId: number): Promise<void> {
    await this.teamsService.delete(teamId);
  }
}

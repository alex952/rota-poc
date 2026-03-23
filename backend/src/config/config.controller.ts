import { Controller, Get } from '@nestjs/common';

import { AppConfigService } from './app-config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  getConfig() {
    return { city: this.appConfigService.city };
  }
}

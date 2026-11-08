import { ConfigService } from '@nestjs/config';

import { AppConfigService } from '../../src/config/app-config.service';

function configWith(values: Record<string, string | undefined>): AppConfigService {
  return new AppConfigService({ get: (key: string) => values[key] } as unknown as ConfigService);
}

describe('AppConfigService — ciudad', () => {
  it('sin CITY usa Alicante, la ciudad del hospital (festivos de la Comunitat Valenciana)', () => {
    expect(configWith({}).city).toBe('Alicante');
  });

  it('respeta CITY cuando está definida', () => {
    expect(configWith({ CITY: 'Madrid' }).city).toBe('Madrid');
  });
});

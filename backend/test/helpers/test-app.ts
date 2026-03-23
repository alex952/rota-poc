import { RequestMethod, ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';

export async function createTestApp(): Promise<NestFastifyApplication> {
  process.env.DB_TYPE = 'sqljs';
  process.env.CITY = process.env.CITY ?? 'Madrid';
  process.env.HOLIDAY_API_URL = process.env.HOLIDAY_API_URL ?? 'https://date.nager.at/api/v3';
  const { AppModule } = await import('../../src/app.module');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.enableCors({ origin: '*' });

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

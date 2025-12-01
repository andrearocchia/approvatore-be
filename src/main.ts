import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RolesGuard } from './auth/roles.guard';
import { json, urlencoded } from 'express';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const corsUrl = configService.get<string>('CORS_URL');

  // PAYLOAD (per XML grandi)
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ limit: '100mb', extended: true }));

  app.enableCors({
    origin: corsUrl,
    credentials: true,
  });

  // Ruoli globali
  const rolesGuard = app.get(RolesGuard);
  app.useGlobalGuards(rolesGuard);

  await app.listen(3000);
}
bootstrap();

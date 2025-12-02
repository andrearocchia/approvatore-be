import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RolesGuard } from './auth/roles.guard';
import { json, urlencoded } from 'express';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const corsEnv = configService.get<string>('CORS_URL');

  const allowedOrigins: string[] = [
    corsEnv,
    'http://localhost:5173',
    'http://localhost',
    'http://localhost:3000',
  ].filter((o): o is string => typeof o === 'string' && o.length > 0);

  // CORS multi-origine
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Ruoli globali
  const rolesGuard = app.get(RolesGuard);
  app.useGlobalGuards(rolesGuard);

  // === Serve il frontend buildato ===
  const publicPath = join(__dirname, '..', 'public');

  app.useStaticAssets(publicPath, {
    prefix: '/',
  });

  // SPA fallback
  app.use((req, res, next) => {
    if (
      !req.url.startsWith('/auth') &&
      !req.url.startsWith('/users') &&
      !req.url.startsWith('/invoices') &&
      !req.url.includes('.')
    ) {
      res.sendFile(join(publicPath, 'index.html'));
    } else {
      next();
    }
  });

  await app.listen(3000);
  console.log('🚀 Backend running on http://localhost:3000');
  console.log('🌐 Allowed origins:', allowedOrigins);
}
bootstrap();

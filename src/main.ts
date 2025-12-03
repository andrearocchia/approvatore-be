import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RolesGuard } from './auth/roles.guard';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const rolesGuard = app.get(RolesGuard);
  app.useGlobalGuards(rolesGuard);

  const publicPath = join(__dirname, '..', 'public');

  app.useStaticAssets(publicPath, {
    prefix: '/',
  });

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
}
bootstrap();
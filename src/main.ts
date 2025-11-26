import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RolesGuard } from './auth/roles.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: "http://localhost:5173",
    credentials: true,
  });

  // otteniamo l'istanza del RolesGuard dal container e lo installiamo globalmente
  const rolesGuard = app.get(RolesGuard);
  app.useGlobalGuards(rolesGuard);

  await app.listen(3000);
}
bootstrap();

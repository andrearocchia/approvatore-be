import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: { username: string; password: string }) {
    try {
      const user = await this.auth.validateUser(dto.username, dto.password);

      if (!user) {
        this.logger.warn(`Failed login attempt for user: ${dto.username}`);
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Utente loggato: ${dto.username}`);
      return this.auth.login(user);

    } catch (error) {
      this.logger.error(`Login error for user: ${dto.username}`, error.stack,);

      // se è già un HttpException lo rilanciamo
      if (error instanceof HttpException) {throw error;}

      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR,);
    }
  }

  @Post('register')
  async register(
    @Body() dto: { username: string; password: string; role: string },
  ) {
    try {
      const user = await this.auth.register(
        dto.username,
        dto.password,
        dto.role,
      );

      this.logger.log(`User registered: username: ${user.username}, role: ${user.role}`,);
      return { user };

    } catch (error) {
      this.logger.error(`User registration failed for: ${dto.username}`, error.stack,);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException('User registration failed', HttpStatus.BAD_REQUEST,);
    }
  }
}
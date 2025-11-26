import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: { username: string; password: string }) {
    const user = await this.auth.validateUser(dto.username, dto.password);
    if (!user) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    return this.auth.login(user);
  }

  // optional register endpoint for quick seeding
  @Post('register')
  async register(@Body() dto: { username: string; password: string; role: string }) {
    const user = await this.auth.register(dto.username, dto.password, dto.role);
    return { user };
  }
}

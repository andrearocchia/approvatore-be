import { Controller, Post, Body, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Post('create')
  async createUser(
    @Body() dto: { username: string; password: string; role: string }
  ) {
    return this.users.createUser(dto.username, dto.password, dto.role);
  }

  @Post('login')
  async login(@Body() dto: { username: string; password: string }) {
    const user = await this.users.validateUser(dto.username, dto.password);
    if (!user) return { success: false, message: 'Credenziali non valide' };

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  @Get()
  getAll() {
    return this.users.getAllUsers();
  }
}

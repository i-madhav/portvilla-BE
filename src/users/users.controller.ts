import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt.interface';

import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';
import { GetMeEndpoint } from './swagger/users.swagger';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @GetMeEndpoint()
  getMe(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    return this.usersService.getMe(user.sub);
  }
}

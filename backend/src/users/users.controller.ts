import { Body, Controller, Get, Param, Put, Query, UseGuards, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './services/users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ListUsersQueryDto, UpdateProfileDto } from './dto/user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users (excludes self) with optional search' })
  list(@CurrentUser() user: CurrentUserPayload, @Query() q: ListUsersQueryDto) {
    return this.users.listUsers(user.id, q);
  }

  @Get('online')
  @ApiOperation({ summary: 'Get list of online user IDs' })
  online() {
    return this.users.getOnlineUserIds();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  me(@CurrentUser() user: CurrentUserPayload) {
    return this.users.getProfile(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Post('me/presence')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update online presence' })
  presence(@CurrentUser() user: CurrentUserPayload, @Body() body: { isOnline: boolean }) {
    return this.users.updatePresence(user.id, !!body?.isOnline);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  get(@Param('id') id: string) {
    return this.users.getUser(id);
  }
}

import { Body, Controller, Get, Param, Post, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConversationsService } from './services/conversations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { CreateConversationDto, ListConversationsQueryDto } from './dto/conversation.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'List conversations of current user' })
  list(@CurrentUser() user: CurrentUserPayload, @Query() q: ListConversationsQueryDto) {
    return this.conversations.listConversations(user.id, q);
  }

  @Post()
  @ApiOperation({ summary: 'Create or get an existing private conversation' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateConversationDto) {
    return this.conversations.createOrGet(user.id, dto.otherUserId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by id' })
  get(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.conversations.getConversation(user.id, id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark conversation as read' })
  markRead(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.conversations.markConversationRead(user.id, id);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MessagesService } from './services/messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { SendMessageDto, ListMessagesQueryDto, MessagesBeforeQueryDto, ForwardMessageDto } from './dto/message.dto';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List messages in a conversation (paginated)' })
  list(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Query() q: ListMessagesQueryDto) {
    return this.messages.listMessages(user.id, id, q);
  }

  @Get('conversations/:id/messages/before')
  @ApiOperation({ summary: 'List messages older than a timestamp (for infinite scroll)' })
  before(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Query() q: MessagesBeforeQueryDto) {
    return this.messages.listMessagesBefore(user.id, id, q);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message (text or with attachment)' })
  send(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: SendMessageDto) {
    if (dto.attachmentId) {
      return this.messages.sendWithAttachment(user.id, id, dto);
    }
    return this.messages.sendText(user.id, id, dto);
  }

  @Get('messages/:id')
  @ApiOperation({ summary: 'Get a single message by id' })
  get(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.messages.getMessage(user.id, id);
  }

  @Delete('messages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a message (only sender)' })
  delete(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.messages.delete(user.id, id);
  }

  @Post('messages/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a message (and all prior) as read' })
  markRead(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.messages.markRead(user.id, id);
  }

  @Post('messages/:id/forward')
  @ApiOperation({ summary: 'Forward a message to another conversation' })
  forward(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: ForwardMessageDto) {
    return this.messages.forward(user.id, id, dto);
  }

  @Post('conversations/:id/delivered')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all SENT messages in a conversation as DELIVERED to me' })
  markDelivered(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.messages.markDelivered(user.id, id);
  }
}

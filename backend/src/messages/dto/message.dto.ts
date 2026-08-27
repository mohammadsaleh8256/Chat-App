import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class SendMessageDto {
  @IsString()
  // Allow empty content when an attachment is present (file-only messages)
  content!: string;

  @IsOptional()
  @IsString()
  type?: string; // TEXT | IMAGE | VIDEO | AUDIO | FILE

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsUUID()
  attachmentId?: string;
}

export class ListMessagesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize: number = 50;
}

export class MessagesBeforeQueryDto {
  @IsDateString() before!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize: number = 50;
}

export class ForwardMessageDto {
  @IsUUID()
  @IsNotEmpty()
  targetConversationId!: string;
}

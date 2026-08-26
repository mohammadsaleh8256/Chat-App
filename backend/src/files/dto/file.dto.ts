import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class InitUploadDto {
  @IsString()
  @IsNotEmpty({ message: 'نام فایل الزامی است.' })
  @MaxLength(512)
  fileName!: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000_000) // 100GB sanity cap; configurable per-env
  fileSize!: number;

  @IsInt()
  @Min(1)
  @Max(100_000)
  totalChunks!: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class CompleteUploadDto {
  @IsOptional()
  @IsString()
  fileHash?: string;
}

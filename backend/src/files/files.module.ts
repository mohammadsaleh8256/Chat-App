import { Module } from '@nestjs/common';
import { FilesService } from './services/files.service';
import { FilesController } from './files.controller';
import { LocalFileStorage } from './storage/local-file-storage';
import { FILE_STORAGE_TOKEN, IFileStorage } from './storage/file-storage.interface';

export const FILE_STORAGE = Symbol('FILE_STORAGE');

@Module({
  providers: [
    FilesService,
    { provide: FILE_STORAGE_TOKEN, useClass: LocalFileStorage },
  ],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}

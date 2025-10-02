import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProjectBuilderService } from './project-builder.service';

@Module({
  imports: [HttpModule],
  providers: [ProjectBuilderService],
  exports: [ProjectBuilderService],
})
export class ProjectBuilderModule {}

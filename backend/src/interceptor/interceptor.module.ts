import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelemetryLog } from './telemetry-log.model';
import { TelemetryLogService } from './telemetry-log.service';
import { LoggingInterceptor } from './LoggingInterceptor';
import { User } from 'src/user/user.model';

@Module({
  imports: [TypeOrmModule.forFeature([TelemetryLog, User])],
  providers: [TelemetryLogService, LoggingInterceptor],
  exports: [TelemetryLogService, LoggingInterceptor],
})
export class InterceptorModule {}

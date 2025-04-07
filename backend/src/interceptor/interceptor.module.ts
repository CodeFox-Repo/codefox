import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelemetryLog } from './telemetry-log.model';
import { TelemetryLogService } from './telemetry-log.service';
import { LoggingInterceptor } from './LoggingInterceptor';

@Module({
  imports: [TypeOrmModule.forFeature([TelemetryLog])],
  providers: [TelemetryLogService, LoggingInterceptor],
  exports: [TelemetryLogService, LoggingInterceptor],
})
export class InterceptorModule {}

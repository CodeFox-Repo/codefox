import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelemetryLog } from './telemetry-log.model';

@Injectable()
export class TelemetryLogService {
  constructor(
    @InjectRepository(TelemetryLog)
    private telemetryLogRepository: Repository<TelemetryLog>,
  ) {}

  async create(data: Partial<TelemetryLog>): Promise<TelemetryLog> {
    const telemetryLog = this.telemetryLogRepository.create(data);
    return await this.telemetryLogRepository.save(telemetryLog);
  }

  async findAll(): Promise<TelemetryLog[]> {
    return await this.telemetryLogRepository.find({
      order: { timestamp: 'DESC' },
      take: 100,
    });
  }

  async findById(id: number): Promise<TelemetryLog> {
    return await this.telemetryLogRepository.findOne({ where: { id } });
  }
}

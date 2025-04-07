import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelemetryLog } from './telemetry-log.model';
import { TelemetryLogFilterInput } from 'src/dashboard/dto/telemetry-log-input';

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

  async findFiltered(filter: TelemetryLogFilterInput): Promise<TelemetryLog[]> {
    const query = this.telemetryLogRepository.createQueryBuilder('log');

    if (filter.startDate) {
      query.andWhere('log.timestamp >= :startDate', {
        startDate: filter.startDate,
      });
    }
    if (filter.endDate) {
      query.andWhere('log.timestamp <= :endDate', { endDate: filter.endDate });
    }
    if (filter.requestMethod) {
      query.andWhere('log.requestMethod = :requestMethod', {
        requestMethod: filter.requestMethod,
      });
    }
    if (filter.endpoint) {
      query.andWhere('log.endpoint LIKE :endpoint', {
        endpoint: `%${filter.endpoint}%`,
      });
    }
    if (filter.handler) {
      query.andWhere('log.handler LIKE :handler', {
        handler: `%${filter.handler}%`,
      });
    }
    if (filter.minTimeConsumed !== undefined) {
      query.andWhere('log.timeConsumed >= :minTimeConsumed', {
        minTimeConsumed: filter.minTimeConsumed,
      });
    }
    if (filter.maxTimeConsumed !== undefined) {
      query.andWhere('log.timeConsumed <= :maxTimeConsumed', {
        maxTimeConsumed: filter.maxTimeConsumed,
      });
    }
    if (filter.search) {
      query.andWhere(
        '(log.endpoint LIKE :search OR log.requestMethod LIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    query.orderBy('log.timestamp', 'DESC');

    return await query.getMany();
  }

  async countTelemetryLogs(filter?: TelemetryLogFilterInput): Promise<number> {
    const query = this.telemetryLogRepository.createQueryBuilder('log');

    if (filter) {
      if (filter.startDate) {
        query.andWhere('log.timestamp >= :startDate', {
          startDate: filter.startDate,
        });
      }
      if (filter.endDate) {
        query.andWhere('log.timestamp <= :endDate', {
          endDate: filter.endDate,
        });
      }
      if (filter.requestMethod) {
        query.andWhere('log.requestMethod = :requestMethod', {
          requestMethod: filter.requestMethod,
        });
      }
      if (filter.endpoint) {
        query.andWhere('log.endpoint LIKE :endpoint', {
          endpoint: `%${filter.endpoint}%`,
        });
      }
      if (filter.email) {
        query.andWhere('log.email = :email', { email: filter.email });
      }
      if (filter.handler) {
        query.andWhere('log.handler LIKE :handler', {
          handler: `%${filter.handler}%`,
        });
      }
      if (filter.minTimeConsumed !== undefined) {
        query.andWhere('log.timeConsumed >= :minTimeConsumed', {
          minTimeConsumed: filter.minTimeConsumed,
        });
      }
      if (filter.maxTimeConsumed !== undefined) {
        query.andWhere('log.timeConsumed <= :maxTimeConsumed', {
          maxTimeConsumed: filter.maxTimeConsumed,
        });
      }
      if (filter.search) {
        query.andWhere(
          '(log.endpoint LIKE :search OR log.requestMethod LIKE :search)',
          { search: `%${filter.search}%` },
        );
      }
    }
    return await query.getCount();
  }
}

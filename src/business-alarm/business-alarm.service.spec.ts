import { Test, TestingModule } from '@nestjs/testing';
import { BusinessAlarmService } from './business-alarm.service';

describe('BusinessAlarmService', () => {
  let service: BusinessAlarmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessAlarmService],
    }).compile();

    service = module.get<BusinessAlarmService>(BusinessAlarmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

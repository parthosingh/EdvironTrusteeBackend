import { Test, TestingModule } from '@nestjs/testing';
import { BusinessAlarmResolver } from './business-alarm.resolver';

describe('BusinessAlarmResolver', () => {
  let resolver: BusinessAlarmResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessAlarmResolver],
    }).compile();

    resolver = module.get<BusinessAlarmResolver>(BusinessAlarmResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});

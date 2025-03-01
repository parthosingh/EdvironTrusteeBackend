import { Test, TestingModule } from '@nestjs/testing';
import { BusinessAlarmController } from './business-alarm.controller';

describe('BusinessAlarmController', () => {
  let controller: BusinessAlarmController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessAlarmController],
    }).compile();

    controller = module.get<BusinessAlarmController>(BusinessAlarmController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

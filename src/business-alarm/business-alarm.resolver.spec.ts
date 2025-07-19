import { Test, TestingModule } from '@nestjs/testing';
import { BusinessAlarmResolver } from './business-alarm.resolver';
import { BusinessAlarmService } from './business-alarm.service';
import { EmailService } from '../email/email.service';

describe('BusinessAlarmResolver', () => {
  let resolver: BusinessAlarmResolver;
  let businessServices: BusinessAlarmService;
  let emailService: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessAlarmResolver,
        {
          provide: BusinessAlarmService,
          useValue: { checkMerchantSettlement: jest.fn() },
        },
        {
          provide: EmailService,
          useValue: { sendAlert: jest.fn() },
        },
      ],
    }).compile();

    resolver = module.get<BusinessAlarmResolver>(BusinessAlarmResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should call checkMerchantSettlement and send an alert email', async () => {
    const mockMissMatchedData = [{ id: 1, status: 'Failed' }];
    // jest.spyOn(businessServices, 'checkMerchantSettlement').mockResolvedValue(mockMissMatchedData);

    const result = await resolver.checkMerchantSettlement();

    expect(businessServices.checkMerchantSettlement).toHaveBeenCalled();
    expect(emailService.sendAlert).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
    );
    expect(result).toBe(true);
  });
});

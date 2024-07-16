import { Test, TestingModule } from '@nestjs/testing';
import { CashfreeService } from './cashfree.service';

describe('CashfreeService', () => {
  let service: CashfreeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CashfreeService],
    }).compile();

    service = module.get<CashfreeService>(CashfreeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { TrusteeService } from './trustee.service';

describe('TrusteeService', () => {
  let service: TrusteeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrusteeService],
    }).compile();

    service = module.get<TrusteeService>(TrusteeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

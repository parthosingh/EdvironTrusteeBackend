import { Test, TestingModule } from '@nestjs/testing';
import { SubTrusteeService } from './sub-trustee.service';

describe('SubTrusteeService', () => {
  let service: SubTrusteeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubTrusteeService],
    }).compile();

    service = module.get<SubTrusteeService>(SubTrusteeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ReconcilationService } from './reconcilation.service';

describe('ReconcilationService', () => {
  let service: ReconcilationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReconcilationService],
    }).compile();

    service = module.get<ReconcilationService>(ReconcilationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { MainBackendService } from './main-backend.service';

describe('MainBackendService', () => {
  let service: MainBackendService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MainBackendService],
    }).compile();

    service = module.get<MainBackendService>(MainBackendService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

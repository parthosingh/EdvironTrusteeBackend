import { Test, TestingModule } from '@nestjs/testing';
import { CanteenService } from './canteen.service';

describe('CanteenService', () => {
  let service: CanteenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CanteenService],
    }).compile();

    service = module.get<CanteenService>(CanteenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

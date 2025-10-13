import { Test, TestingModule } from '@nestjs/testing';
import { CanteenController } from './canteen.controller';

describe('CanteenController', () => {
  let controller: CanteenController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CanteenController],
    }).compile();

    controller = module.get<CanteenController>(CanteenController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

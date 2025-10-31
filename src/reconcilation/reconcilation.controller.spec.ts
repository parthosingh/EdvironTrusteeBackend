import { Test, TestingModule } from '@nestjs/testing';
import { ReconcilationController } from './reconcilation.controller';

describe('ReconcilationController', () => {
  let controller: ReconcilationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReconcilationController],
    }).compile();

    controller = module.get<ReconcilationController>(ReconcilationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

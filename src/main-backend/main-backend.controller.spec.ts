import { Test, TestingModule } from '@nestjs/testing';
import { MainBackendController } from './main-backend.controller';

describe('MainBackendController', () => {
  let controller: MainBackendController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MainBackendController],
    }).compile();

    controller = module.get<MainBackendController>(MainBackendController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

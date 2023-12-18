import { Test, TestingModule } from '@nestjs/testing';
import { TrusteeController } from './trustee.controller';

describe('TrusteeController', () => {
  let controller: TrusteeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrusteeController],
    }).compile();

    controller = module.get<TrusteeController>(TrusteeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

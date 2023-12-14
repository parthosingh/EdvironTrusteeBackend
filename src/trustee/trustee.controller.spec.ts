import { Test, TestingModule } from '@nestjs/testing';
import { TrusteeController } from './trustee.controller';
import { TrusteeService } from './trustee.service';
import { Trustee } from './schemas/trustee.schema';
import { getModelToken } from '@nestjs/mongoose';

describe('TrusteeController', () => {
  let controller: TrusteeController;
  let service: TrusteeService
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrusteeController],
      providers:[TrusteeService,
        {provide: getModelToken('Trustee'),  
        useValue: {}}
      ]
    }).compile();

    controller = module.get<TrusteeController>(TrusteeController);
    service = module.get<TrusteeService>(TrusteeService);


  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  
});

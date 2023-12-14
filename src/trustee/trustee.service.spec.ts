import { Test, TestingModule } from '@nestjs/testing';
import { TrusteeService } from './trustee.service';
import { getModelToken } from '@nestjs/mongoose';
import { Trustee } from './schemas/trustee.schema';
import { mock } from 'node:test';
import { Connection, Model } from 'mongoose';
import { Mode } from 'node:fs';
import { NotFoundError } from 'rxjs';

describe('TrusteeService', () => {
   
  
  const MockTrusteeModel = {
    genrateLink: jest.fn(),
  };
  let model:Model<Trustee>
  let service: TrusteeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrusteeService,
        {provide:Connection, useValue:{}},
        {
        provide: getModelToken(Trustee.name),
        useValue:MockTrusteeModel
      },
      
    ],
    }).compile();

    service = module.get<TrusteeService>(TrusteeService);
    
  });

  

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('findTrustee',()=>{
    it('should return trustee',async()=>{
      const expectedTrustee=[]

      const trustee = await service.genrateLink('17979')
      expect(MockTrusteeModel.genrateLink).toHaveBeenCalledWith();
    })
  })

  describe('otherwise',()=>{
    it('should throw Error',async()=>{
      MockTrusteeModel.genrateLink.mockImplementationOnce(()=>{
        throw new Error('Some error occurred during find operation')
      })
    })
  })
});

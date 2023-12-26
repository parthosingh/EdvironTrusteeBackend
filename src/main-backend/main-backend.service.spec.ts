import { Test, TestingModule } from '@nestjs/testing';
import { MainBackendService } from './main-backend.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Connection } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Trustee } from '../schema/trustee.schema';
import { TrusteeSchool } from '../schema/school.schema';



const mockMainBackendService={
  createTrustee:jest.fn(),
  findTrustee:jest.fn(),
  findOneTrustee:jest.fn(),
  checkSchoolLimit:jest.fn()
}

const trusteeObj={
  name:'john Doe',
  email_id:'example@gmail.com',
  password_hash:'password',
  school_limit:150
}

const MockJwtService = {
  sign: jest.fn(),
};

const MockTrusteeSchoolModel = {
  findOne: jest.fn(),
};

const mockTrusteeModel ={
  find:jest.fn(),
  findOne:jest.fn(),
  countDocuments:jest.fn(),
}

describe('MainBackendService', () => {
  let service: MainBackendService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MainBackendService,
        { provide: Connection, useValue: {} },
        { provide: getModelToken(Trustee.name), useValue: mockTrusteeModel },
        { provide: getModelToken(TrusteeSchool.name), useValue: MockTrusteeSchoolModel },
        
        { provide: JwtService, useValue: MockJwtService }, // Provide the mockJwtService

      ],
    }).compile();

    service = module.get<MainBackendService>(MainBackendService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('findTrustee',()=>{
    it('should return trustee array',async()=>{
      const page = 1;
      const pageSize = 10;
      const totalItems = 20;

      const trusteeData = [
        { name: 'John Doe', email_id: 'john@example.com', school_limit: 150 },
        { name: 'Jane Doe', email_id: 'jane@example.com', school_limit: 120 },
      ];

      mockTrusteeModel.countDocuments.mockResolvedValueOnce(totalItems);
      mockTrusteeModel.find.mockReturnValueOnce(trusteeData);

      const result = await service.findTrustee(page, pageSize);

      expect(mockTrusteeModel.countDocuments).toHaveBeenCalled();
      expect(mockTrusteeModel.find).toHaveBeenCalledWith();

      expect(result).toEqual({
        data: trusteeData,
        page,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
        totalItems,
      });
    })
  })
});

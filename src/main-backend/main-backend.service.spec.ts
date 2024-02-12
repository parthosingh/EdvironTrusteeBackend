import { Test, TestingModule } from '@nestjs/testing';
import { MainBackendService } from './main-backend.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Connection, connect, Model, Types } from 'mongoose';
import mongoose from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { BadGatewayException, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SchoolSchema, TrusteeSchool } from '../schema/school.schema';
import exp from 'constants';
jest.mock('@nestjs/jwt');




const trusteeObj = {
  name: 'john Doe',
  email_id: 'example@gmail.com',
  password_hash: 'password',
  school_limit: 150
}

const MockJwtService = {
  sign: jest.fn(),
};



let model: Model<Trustee>
let service: MainBackendService
let mongod: MongoMemoryServer;

describe('MainBackendService', () => {

  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let trusteeModel: Model<Trustee>;
  let trusteeSchoolModel: Model<TrusteeSchool>;
  let jwtService: JwtService
  let service: MainBackendService


  beforeAll(async () => {
    mongod = await MongoMemoryServer.create(); // Use create() method instead of new MongoMemoryServer()
    const uri = mongod.getUri();
    mongoConnection = (await connect(uri)).connection;
    trusteeModel = mongoConnection.model(Trustee.name, TrusteeSchema);
    trusteeSchoolModel = mongoConnection.model(
      TrusteeSchool.name,
      SchoolSchema,)
  });

  afterAll(async () => {
    await mongod.stop();
    await mongoose.disconnect();
  });


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MainBackendService,
        { provide: Connection, useValue: {} },
        { provide: getModelToken(Trustee.name), useValue: trusteeModel },
        { provide: getModelToken(TrusteeSchool.name), useValue: trusteeSchoolModel },

        { provide: JwtService, useValue: MockJwtService }, // Provide the mockJwtService

      ],
    }).compile();

    service = module.get<MainBackendService>(MainBackendService);
    jwtService = module.get<JwtService>(JwtService)
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTrustee', () => {
    it('should create a new trustee', async () => {
      const trusteeInfo = {
        name: 'John Doe',
        email: 'jo55hn@3example.com',
        password: 'password',
        school_limit: 150,
        phone_number: '1237567890',
      };
      const mockResponse = {
        name: 'test 001',
        email_id: 'one@gmail',
        password_hash: '$2b$10$.ykb8jlprPpauXQl6pK2jePMPVl6XI0qxjLF6chZHY8dF0T/zNW76',
        school_limit: 150,
        IndexOfApiKey: 0,
        phone_number: '444444444',
        _id: new Types.ObjectId('6597f1a2e1c3f34153b8f095'),
        createdAt: "2024-01-05T12:10:10.300Z",
        updatedAt: "2024-01-05T12:10:10.300Z",
        __v: 0
      }

      jest.spyOn(trusteeModel, 'findOne').mockResolvedValue(null)
      jest.spyOn(trusteeModel, 'create').mockResolvedValue(mockResponse as any);
      const result = await service.createTrustee(trusteeInfo);

      expect(trusteeModel.findOne).toHaveBeenCalledWith({ email_id: trusteeInfo.email });
      expect(trusteeModel.create).toHaveBeenCalledWith({
        name: trusteeInfo.name,
        email_id: trusteeInfo.email,
        password_hash: trusteeInfo.password,
        school_limit: trusteeInfo.school_limit,
        phone_number: trusteeInfo.phone_number,
      });

      expect(result).toEqual(mockResponse);
    });

    it('should throw ConflictException when email already exists', async () => {
      const trusteeInfo = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password',
        school_limit: 150,
        phone_number: '1234567890',
      };
      jest.spyOn(trusteeModel, 'findOne').mockResolvedValue(true)
      await expect(service.createTrustee(trusteeInfo)).rejects.toThrowError(ConflictException);
    });
    it('should throw BadRequestException for other errors', async () => {
      
      jest.spyOn(trusteeModel, 'findOne').mockRejectedValue(new Error('Some unexpected error'));
  
      const info = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password',
        school_limit: 150,
        phone_number: '1234567890',
      };
      await expect(service.createTrustee(info)).rejects.toThrowError(BadRequestException);
    });
  
  });
  
  

  describe('findTrustee', () => {
    it('should return arrays of trustee', async () => {
      const mockTrustee = [
        { name: 'John Doe', email_id: 'john@example.com', school_limit: 150 },
        { name: 'Jane Doe', email_id: 'jane@example.com', school_limit: 120 },
      ]
      jest.spyOn(trusteeModel, 'countDocuments').mockResolvedValue(10)
      jest.spyOn(trusteeModel, 'find').mockImplementation(
        () => ({
          skip: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockTrustee),
        }) as any
      )
      const page = 1
      const pageSize = 5

      const result = await service.findTrustee(page, pageSize)
      expect(trusteeModel.find).toHaveBeenCalledWith();

      expect(result).toEqual(
        {
          data: mockTrustee,
          page: 1,
          pageSize: 5,
          totalPages: 2,
          totalItems: 10
        }
      )
    })
    it('should throw Badrequest Exception', async () => {
      jest.spyOn(trusteeModel, 'countDocuments').mockRejectedValue(new Error('Test error'));

      const page = 1;
      const pageSize = 5;

      await expect(service.findTrustee(page, pageSize)).rejects.toThrowError(NotFoundException);

    })
  })

  describe('findOneTrustee',()=>{
    it('should return one trustee',async()=>{
      const mockResponse = {
        name: 'test 001',
        email_id: 'one@gmail',
        password_hash: '$2b$10$.ykb8jlprPpauXQl6pK2jePMPVl6XI0qxjLF6chZHY8dF0T/zNW76',
        school_limit: 150,
        IndexOfApiKey: 0,
        phone_number: '444444444',
        _id: new Types.ObjectId('658e759736ba0754ca45d0c2'),
        createdAt: "2024-01-05T12:10:10.300Z",
        updatedAt: "2024-01-05T12:10:10.300Z",
        __v: 0
      }
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c2')
      jest.spyOn(trusteeModel,'findOne').mockResolvedValue(mockResponse)
      const result = await service.findOneTrustee(trusteeId)
      expect(trusteeModel.findOne).toHaveBeenCalledWith(trusteeId)
      expect(result).toEqual(mockResponse)

    })
    it('should throw BadRequestError',async()=>{
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c9')
    jest.spyOn(trusteeModel, 'findOne').mockRejectedValue(new Error('Test error'));

    await expect(service.findOneTrustee(trusteeId)).rejects.toThrowError(BadRequestException);
  
    })
  })
  describe('checkSchoolLimit',()=>{
    it('should return school limit',async()=>{
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c2')
      jest.spyOn(trusteeSchoolModel,'countDocuments').mockResolvedValue(10)
      const result = await service.checkSchoolLimit(trusteeId)
      expect(trusteeSchoolModel.countDocuments).toHaveBeenCalledWith({trustee_id:trusteeId})

      expect(result).toEqual(10)
    })
    it('should throw BadRequestException',async()=>{
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c2')
      jest.spyOn(trusteeSchoolModel,'countDocuments').mockRejectedValue(new BadRequestException('Test error'));

      await expect(service.checkSchoolLimit(trusteeId)).rejects.toThrowError(BadRequestException);
      
    })
  })
  describe('generateKey', () => {
    it('should generate a unique pg_key', async () => {
      jest.spyOn(service, 'isKeyUnique').mockResolvedValue(true);
      const result = await service.generateKey();
      expect(service.isKeyUnique).toHaveBeenCalledWith(result);
    });
  });
  describe('isKeyUnique', () => {
    it('should return true if pg_key is unique', async () => {
      const uniqueKey = 'uniqueKey';
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(null);

      const result = await service.isKeyUnique(uniqueKey);

      expect(trusteeSchoolModel.findOne).toHaveBeenCalledWith({ pg_key: uniqueKey });
      expect(result).toBe(true);
    });

    it('should return false if pg_key is not unique', async () => {
      const existingKey = 'existingKey';
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue({ pg_key: existingKey });

      const result = await service.isKeyUnique(existingKey);

      expect(trusteeSchoolModel.findOne).toHaveBeenCalledWith({ pg_key: existingKey });
      expect(result).toBe(false);
    });

    it('should throw BadRequestException for other errors', async () => {
      const uniqueKey = 'uniqueKey';
      jest.spyOn(trusteeSchoolModel, 'findOne').mockRejectedValue(new Error('Test error'));

      await expect(service.isKeyUnique(uniqueKey)).rejects.toThrowError(BadRequestException);
    });
  });
  describe('updateSchoolInfo', () => {
    it('should update school details', async () => {
      
      const mockPgkey='qwert67890'

      const info = {
        school_name: 'mock School Name',
        school_id: '658e759736ba0754ca45d0c2',
        trustee_id: '658e759736ba0754ca45d0c1',
        client_id:'client_id',
        client_secret: 'client_secret',
        merchantId: 'merchantId',
        merchantName: 'merchantName',
        merchantEmail: 'merchantemail@9edviron.com',
        merchantStatus: 'merchantStatus',
        pgMinKYC: 'pgMinKYC',
        pgFullKYC: 'pgFullKYC'
      };

      const trusteeId = new Types.ObjectId(info.trustee_id);
      const schoolId = new Types.ObjectId(info.school_id);
      const trustee = {
        _id:trusteeId,
        email: 'test@example.com',
        name: 'John Doe',
        password: 'password123',
        phone_number: '1234567890',
        school_limit: 5,
        iat: 1234567890,
        exp: 1234567890,
      };

      const mockResult ={
        updatedSchool: {
          // _id: new ObjectId('65c86bfb70323b086ca57077'),
          merchantEmail: info.merchantEmail,
          client_id: info.client_id,
          client_secret: info.client_secret,
          merchantId: info.merchantId,
          merchantName: info.merchantName,
          merchantStatus: info.merchantStatus,
          pgFullKYC: info.pgFullKYC,
          pgMinKYC: info.pgMinKYC,
          pg_key: 'newGeneratedKey',
          school_name: info.school_name,
          trustee_id: trusteeId,
        },
        trustee: {
          _id: trusteeId,
          name: 'demo trustee',
          email_id: 'demotrustee@edviron.com',
         
        }
      }
      jest.spyOn(service, 'generateKey').mockResolvedValue('newGeneratedKey');
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue({ _id: trusteeId });
      jest.spyOn(trusteeSchoolModel,'findOne').mockResolvedValue(null)
      jest.spyOn(service,'updateSchoolInfo').mockResolvedValueOnce(mockResult as any)
      jest.spyOn(trusteeSchoolModel, 'findOneAndUpdate').mockResolvedValue({ ...info, pg_key: 'newGeneratedKey' } as any);
      const result = await service.updateSchoolInfo(info);
      
      
      
      expect(result).toBeDefined()
      expect(result).toEqual(mockResult);
    });

    it('should throw NotFoundException if trustee is not found', async () => {
      const info = {
        school_name: 'mock School Name',
        school_id: '658e759736ba0754ca45d0c2',
        trustee_id: '658e759736ba0754ca45d0c1',
        client_id:'client_id',
        client_secret: 'client_secret',
        merchantId: 'merchantId',
        merchantName: 'merchantName',
        merchantEmail: 'merchantemail00@edviron.com',
        merchantStatus: 'merchantStatus',
        pgMinKYC: 'pgMinKYC',
        pgFullKYC: 'pgFullKYC'
      };

      jest.spyOn(service, 'generateKey').mockResolvedValue('newGeneratedKey');
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(null);
      jest.spyOn(trusteeSchoolModel,'findOne').mockResolvedValue(null)
      await expect(service.updateSchoolInfo(info)).rejects.toThrowError(NotFoundException);
    });


    it('should throw BadRequestException for other errors', async () => {
      const info = {
        school_name: 'mock School Name',
        school_id: '658e759736ba0754ca45d0c2',
        trustee_id: '658e759736ba0754ca45d0c1',
        client_id:'client_id',
        client_secret: 'client_secret',
        merchantId: 'merchantId',
        merchantName: 'merchantName',
        merchantEmail: 'merchantemail@edviron.com',
        merchantStatus: 'merchantStatus',
        pgMinKYC: 'pgMinKYC',
        pgFullKYC: 'pgFullKYC'
      };

      const trusteeId = new Types.ObjectId(info.trustee_id);
      jest.spyOn(service, 'generateKey').mockResolvedValue('newGeneratedKey');
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue({ _id: trusteeId });
      jest.spyOn(trusteeSchoolModel,'findOne').mockResolvedValue(null)
      jest.spyOn(trusteeSchoolModel, 'findOneAndUpdate').mockRejectedValue(new Error('Test error'));

      await expect(service.updateSchoolInfo(info)).rejects.toThrowError(BadRequestException);
    });
  });


});
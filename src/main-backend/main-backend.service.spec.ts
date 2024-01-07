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
      // Mock the findOne method to return an existing trustee with the same email


      await expect(service.createTrustee(trusteeInfo)).rejects.toThrowError(ConflictException);
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
  
  describe('assignSchool', () => {
    it('should return assigned school', async () => {
      const schoolId = new Types.ObjectId('658e759736ba0754ca45d0c3');
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c2');
      const schoolName = 'Test School';
  
      const mockTrustee = {
        name: 'test 001',
        email_id: 'one@gmail',
        password_hash: '$2b$10$.ykb8jlprPpauXQl6pK2jePMPVl6XI0qxjLF6chZHY8dF0T/zNW76',
        school_limit: 150,
        IndexOfApiKey: 0,
        phone_number: '444444444',
        _id: trusteeId,
        createdAt: "2024-01-05T12:10:10.300Z",
        updatedAt: "2024-01-05T12:10:10.300Z",
        __v: 0
      };
  
      const mockSchool = {
        school_id: schoolId,
        trustee_id: trusteeId,
        school_name: schoolName,
      };
  
      jest.spyOn(trusteeModel, 'findOne').mockResolvedValue(mockTrustee);
      jest.spyOn(trusteeSchoolModel, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(trusteeSchoolModel, 'find').mockResolvedValue([]);

      jest.spyOn(trusteeSchoolModel, 'create').mockResolvedValue(mockSchool as any);
  
      const result = await service.assignSchool(schoolId, trusteeId, schoolName);
  
      expect(trusteeModel.findOne).toHaveBeenCalledWith(new Types.ObjectId(trusteeId));
      expect(trusteeSchoolModel.countDocuments).toHaveBeenCalledWith({ trustee_id: trusteeId });
      expect(trusteeSchoolModel.find).toHaveBeenCalledWith({ trustee_id: trusteeId, school_id: schoolId });
      expect(trusteeSchoolModel.create).toHaveBeenCalledWith(mockSchool);
      expect(result).toEqual(mockSchool);
    });
  
    it('should throw ForbiddenException when school is already assigned', async () => {
      const schoolId = new Types.ObjectId('658e759736ba0754ca45d0c3');
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c2');
      const schoolName = 'Test School';
  
      const mockTrustee = {
        name: 'test 001',
        email_id: 'one@gmail',
        password_hash: '$2b$10$.ykb8jlprPpauXQl6pK2jePMPVl6XI0qxjLF6chZHY8dF0T/zNW76',
        school_limit: 150,
        IndexOfApiKey: 0,
        phone_number: '444444444',
        _id: trusteeId,
        createdAt: "2024-01-05T12:10:10.300Z",
        updatedAt: "2024-01-05T12:10:10.300Z",
        __v: 0
      };
  
      jest.spyOn(trusteeModel, 'findOne').mockResolvedValue(mockTrustee);
      jest.spyOn(trusteeSchoolModel, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(trusteeSchoolModel, 'find').mockResolvedValue([{ school_id: schoolId }]);
  
      await expect(service.assignSchool(schoolId, trusteeId, schoolName))
        .rejects.toThrowError(ForbiddenException);
    });
  
    it('should throw ForbiddenException when school limit is reached', async () => {
      const schoolId = new Types.ObjectId('658e759736ba0754ca45d0c3');
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c2');
      const schoolName = 'Test School';
  
      const mockTrustee = {
        name: 'test 001',
        email_id: 'one@gmail',
        password_hash: '$2b$10$.ykb8jlprPpauXQl6pK2jePMPVl6XI0qxjLF6chZHY8dF0T/zNW76',
        school_limit: 2,
        IndexOfApiKey: 0,
        phone_number: '444444444',
        _id: trusteeId,
        createdAt: "2024-01-05T12:10:10.300Z",
        updatedAt: "2024-01-05T12:10:10.300Z",
        __v: 0
      };
  
      jest.spyOn(trusteeModel, 'findOne').mockResolvedValue(mockTrustee);
      jest.spyOn(trusteeSchoolModel, 'countDocuments').mockResolvedValue(2);
  
      await expect(service.assignSchool(schoolId, trusteeId, schoolName))
        .rejects.toThrowError(ForbiddenException);
    });
  
    it('should throw BadGatewayException for unknown error', async () => {
      const schoolId = new Types.ObjectId('658e759736ba0754ca45d0c3');
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c2');
      const schoolName = 'Test School';
  
      const mockTrustee = {
        name: 'test 001',
        email_id: 'one@gmail',
        password_hash: '$2b$10$.ykb8jlprPpauXQl6pK2jePMPVl6XI0qxjLF6chZHY8dF0T/zNW76',
        school_limit: 150,
        IndexOfApiKey: 0,
        phone_number: '444444444',
        _id: trusteeId,
        createdAt: "2024-01-05T12:10:10.300Z",
        updatedAt: "2024-01-05T12:10:10.300Z",
        __v: 0
      };
  
      jest.spyOn(trusteeModel, 'findOne').mockResolvedValue(mockTrustee);
      jest.spyOn(trusteeSchoolModel, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(trusteeSchoolModel, 'find').mockResolvedValue([]);
  
      // Simulating an unknown error by rejecting the create method
      jest.spyOn(trusteeSchoolModel, 'create').mockRejectedValue(new Error('Unknown error'));
  
      await expect(service.assignSchool(schoolId, trusteeId, schoolName))
        .rejects.toThrowError(BadGatewayException);
    });
  });
  

});
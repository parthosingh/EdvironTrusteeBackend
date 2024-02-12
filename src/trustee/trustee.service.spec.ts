import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, connect, Model, Types } from 'mongoose';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import { getModelToken } from '@nestjs/mongoose';
import { SchoolSchema, TrusteeSchool } from '../schema/school.schema';
import { TrusteeService } from './trustee.service';
import { ErpService } from '../erp/erp.service';
import { TrusteeResolver } from './trustee.resolver';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { MainBackendService } from '../main-backend/main-backend.service';

describe('TrusteeService', () => {
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let trusteeModel: Model<Trustee>;
  let trusteeSchoolModel: Model<TrusteeSchool>;
  let service: TrusteeService;
  let jwtService: JwtService;

  const mockTrustee = {
    _id: '658e759736ba0754ca45d0c2',
    name: 'John Doe',
    email_id: 'johndoe@example.com',
    school_limit: 5,
    IndexOfApiKey: 3,
    phone_number: 1234567890,
    apiKey: 'sampledApiKey',
    password_hash: '123456',
    save: jest.fn().mockReturnThis(),
  };

  const mockTrusteeSchool = [
    { school_id: 'school1', school_name: 'School 1',pg_key:"test_key" },
    { school_id: 'school2', school_name: 'School 2',pg_key:"test_key2" },
  ];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    mongoConnection = (await connect(uri)).connection;
    trusteeModel = mongoConnection.model(Trustee.name, TrusteeSchema);
    trusteeSchoolModel = mongoConnection.model(
      TrusteeSchool.name,
      SchoolSchema,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrusteeResolver,
        ErpService,
        MainBackendService,
        { provide: getModelToken(Trustee.name), useValue: trusteeModel },
        {
          provide: getModelToken(TrusteeSchool.name),
          useValue: trusteeSchoolModel,
        },
        TrusteeService,
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), verify: jest.fn() },
        },
      ],
    }).compile();
    service = module.get<TrusteeService>(TrusteeService);
    jwtService = module.get<JwtService>(JwtService);
  });
  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
  });
  afterEach(async () => {
    const collections = mongoConnection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(jwtService).toBeDefined()
  });
  describe('getSchools', () => {
    it('should return a list of schools and total pages ', async () => {
      const trusteeObjectId = new mongoose.Types.ObjectId(mockTrustee._id);

      jest.spyOn(Types.ObjectId, 'isValid').mockReturnValue(true);
      const mockDocumentNo = 1;
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(mockTrustee);
      jest
        .spyOn(trusteeSchoolModel, 'countDocuments')
        .mockResolvedValue(mockDocumentNo);
      jest.spyOn(trusteeSchoolModel, 'find').mockImplementation(
        () =>
          ({
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(mockTrusteeSchool),
          }) as any,
      );
      const result = await service.getSchools(mockTrustee._id, 1);
      const mockReturnedData = {
        schoolData: mockTrusteeSchool,
        total_pages: 1,
      };
      // expect(trusteeSchoolModel.find).toHaveBeenCalledWith(
      //   { trustee_id: trusteeObjectId },
      //   { school_id: 1, school_name: 1, _id: 0 },
      // );
      expect(trusteeModel.findById).toHaveBeenCalledWith(mockTrustee._id);
      expect(result).toEqual(mockReturnedData);
    });
    it('should throw BadRequestException for invalid trustee ID format', async () => {
      const invalidTrusteeId = 'invalid_id';
      jest.spyOn(Types.ObjectId, 'isValid').mockReturnValue(false);
      await expect(service.getSchools(invalidTrusteeId, 1)).rejects.toThrow(
        BadRequestException,
      );
    });
    it('should throw ConflictException when no trustee found', async () => {
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(null);
      await expect(service.getSchools(mockTrustee._id, 1)).rejects.toThrow(
        ConflictException,
      );
    });
    it('should handle other errors by throwing BadRequestException', async () => {
      const errorThrowingId = 'invalid-id';
      jest
        .spyOn(trusteeSchoolModel, 'countDocuments')
        .mockImplementation(() => {
          throw new Error('Some unexpected error');
        });
      await expect(service.getSchools(errorThrowingId, 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('loginAndGenerateToken', () => {
    it('should return a token for valid credentials', async () => {

      const mockTrustee = {
        _id: '12345',
        email_id: 'test@example.com',
        password_hash: 'password123',
      };

      jest.spyOn(trusteeModel, 'findOne').mockResolvedValue(mockTrustee);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mockToken');

      const result = await service.loginAndGenerateToken('test@example.com', 'password123');

      expect(result).toEqual({ token: 'mockToken' });
      expect(trusteeModel.findOne).toHaveBeenCalledWith({ email_id: 'test@example.com' });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', mockTrustee.password_hash);
      expect(jwtService.sign).toHaveBeenCalledWith({ id: mockTrustee._id }, {
        secret: process.env.JWT_SECRET_FOR_TRUSTEE_AUTH,
        expiresIn: '30d',
      });
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      jest.spyOn(trusteeModel, 'findOne').mockResolvedValue(null);

      await expect(service.loginAndGenerateToken('nonexistent@example.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for incorrect password', async () => {
      const mockTrustee = {
        _id: '12345',
        email_id: 'test@example.com',
        password_hash:'password123',
      };

      jest.spyOn(trusteeModel, 'findOne').mockResolvedValue(mockTrustee);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(service.loginAndGenerateToken('test@example.com', 'wrongpass')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for unexpected errors', async () => {
      jest.spyOn(trusteeModel, 'findOne').mockRejectedValue(new Error('Unexpected error'));

      await expect(service.loginAndGenerateToken('test@example.com', 'password123')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateTrustee', () => {
    it('should return the trustee data for a valid token', async () => {
      const mockDecodedPayload = { id: '12345' };
      const mockTrustee = {
        _id: '12345',
        name: 'John Doe',
        email_id: 'john.doe@example.com',
        apiKey: 'sampleApiKey',
      };
  
      jest.spyOn(jwtService, 'verify').mockReturnValue(mockDecodedPayload);
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(mockTrustee);
  
      const result = await service.validateTrustee('mockToken');
  
      expect(result).toEqual({
        id: mockTrustee._id,
        name: mockTrustee.name,
        email: mockTrustee.email_id,
        apiKey: mockTrustee.apiKey || null,
      });
      expect(jwtService.verify).toHaveBeenCalledWith('mockToken', {
        secret: process.env.JWT_SECRET_FOR_TRUSTEE_AUTH,
      });
      expect(trusteeModel.findById).toHaveBeenCalledWith(mockDecodedPayload.id);
    });
  
    it('should throw UnauthorizedException for an invalid token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });
  
      await expect(service.validateTrustee('invalidToken')).rejects.toThrow(UnauthorizedException);
    });
  
    it('should throw UnauthorizedException for an invalid or expired token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid or expired token');
      });
  
      await expect(service.validateTrustee('expiredToken')).rejects.toThrow(UnauthorizedException);
    });
  
    it('should throw UnauthorizedException for an unexpected error', async () => {
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(null);
  
      await expect(() => service.validateTrustee('mockToken')).rejects.toThrow(UnauthorizedException);
    });
  
    it('should throw NotFoundException for non-existing trustee', async () => {
      const mockToken = 'validToken';
      const trusteeId = '12345';
  
      jest.spyOn(jwtService, 'verify').mockReturnValue({ id: trusteeId });
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(null);
  
      await expect(service.validateTrustee(mockToken)).rejects.toThrow(UnauthorizedException);
    });
  });
  
  describe('generateSchoolToken', () => {
    const trusteeId = '6099438e651824001f168b50';
    const schoolId = '6099438e651824001f168b51';
    
    it('should return genrated token',async()=>{
      const schoolId = new Types.ObjectId('6504612e617288b970843181');
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c2');
      const password = 'pass';
  
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

      const mockSchool = {
        _id: new Types.ObjectId('658e759736ba0754ca45d0c8'),
        school_id: schoolId,
        trustee_id: trusteeId,
      };

      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(mockTrustee);
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(mockSchool);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mockedToken');
      jest.spyOn(axios, 'post').mockResolvedValue({ data: 'mockedData' });
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      

      const result = await service.generateSchoolToken('6504612e617288b970843181', password, '658e759736ba0754ca45d0c2');

      expect(trusteeModel.findById).toHaveBeenCalledWith("658e759736ba0754ca45d0c2");
      // expect(trusteeModel.findById).toHaveBeenCalledTimes(1);
      expect(trusteeSchoolModel.findOne).toHaveBeenCalledWith({
        school_id: schoolId,
        // trustee_id: trusteeId,
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockTrustee.password_hash);
      expect(jwtService.sign).toHaveBeenCalledWith({ schoolId: mockSchool.school_id }, { secret: process.env.JWT_SECRET_FOR_INTRANET });
      expect(axios.post).toHaveBeenCalledWith(`${process.env.MAIN_BACKEND_URL}/api/trustee/gen-school-token`, {
        token: 'mockedToken',
      });
      expect(result).toEqual('mockedData');

    })

    it('should throw NotFoundException for non-existing school', async () => {
      const password = 'trusteePassword';

      jest.spyOn(trusteeModel, 'findById').mockResolvedValue({ _id: new mongoose.Types.ObjectId(trusteeId) });
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(null);

      await expect(service.generateSchoolToken(schoolId, password, trusteeId)).rejects.toThrowError(NotFoundException);
    });

    it('should throw UnauthorizedException for invalid trustee password', async () => {
      const password = 'invalidPassword';
    
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue({ _id: new mongoose.Types.ObjectId(trusteeId) });
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId(), trustee_id: new mongoose.Types.ObjectId(trusteeId) });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
    
      await expect(service.generateSchoolToken(schoolId, password, trusteeId)).rejects.toThrowError(UnauthorizedException);
    });
    
    it('should throw BadRequestException for invalid school ID format', async () => {
      const schoolId = 'invalidSchoolId';
      const password = 'trusteePassword';
    
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue({ _id: new mongoose.Types.ObjectId(trusteeId) });
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(false);
    
      await expect(service.generateSchoolToken(schoolId, password, trusteeId)).rejects.toThrowError(BadRequestException);
    });
    it('should throw NotFoundException for non-existing trustee', async () => {
      const password = 'trusteePassword';
    
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(null);
    
      await expect(service.generateSchoolToken(schoolId, password, trusteeId)).rejects.toThrowError(NotFoundException);
    });
    
    it('should throw NotFoundException for non-existing school', async () => {
      const password = 'trusteePassword';
    
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue({ _id: new mongoose.Types.ObjectId(trusteeId) });
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(null);
    
      await expect(service.generateSchoolToken(schoolId, password, trusteeId)).rejects.toThrowError(NotFoundException);
    });
    
    it('should throw NotFoundException if school is not associated with the trustee', async () => {
      const password = 'trusteePassword';
    
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue({ _id: new mongoose.Types.ObjectId(trusteeId) });
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId(), trustee_id: new mongoose.Types.ObjectId() });
    
      await expect(service.generateSchoolToken(schoolId, password, trusteeId)).rejects.toThrowError(NotFoundException);
    });
  });


});

import { Test, TestingModule } from '@nestjs/testing';
import { MainBackendController } from './main-backend.controller';
import { MainBackendService } from './main-backend.service';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import { FullKycStatus, MerchantStatus, MinKycStatus, SchoolSchema, TrusteeSchool } from '../schema/school.schema';
import { JwtPayload } from 'jsonwebtoken';
import mongoose, { Connection, connect, Model, Types } from 'mongoose';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mock } from 'node:test';
import { TrusteeService } from '../trustee/trustee.service';

const mockMainbackenService = {
  createTrustee: jest.fn(),
  findTrustee: jest.fn(),
  findOneTrustee: jest.fn(),
  assignSchool: jest.fn(),
  updateSchoolInfo: jest.fn(),
};

const MockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

describe('MainBackendController', () => {
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let trusteeModel: Model<Trustee>;
  let trusteeSchoolModel: Model<TrusteeSchool>;
  let controller: MainBackendController;
  let service: MainBackendService;
  let jwtService: JwtService;
  let jwt: JwtService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    mongoConnection = (await connect(uri)).connection;
    trusteeModel = mongoConnection.model(Trustee.name, TrusteeSchema);
    trusteeSchoolModel = mongoConnection.model(
      TrusteeSchool.name,
      SchoolSchema,
    );
  });

  afterAll(async () => {
    await mongod.stop();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MainBackendController],
      providers: [
        MainBackendService,
        { provide: Connection, useValue: {} },
        {
          provide: getModelToken(Trustee.name),
          useValue: trusteeModel,
        },
        {
          provide: getModelToken(TrusteeSchool.name),
          useValue: trusteeSchoolModel,
        },
        {
          provide: JwtService,
          useValue: MockJwtService,
        },
        {
          provide: MainBackendService,
          useValue: mockMainbackenService,
        },
        TrusteeService,
      ],
    }).compile();

    controller = module.get<MainBackendController>(MainBackendController);
    service = module.get<MainBackendService>(MainBackendService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTrustee', () => {
    it('should return a signed JWT token', async () => {
      const mockData = { data: 'mockData' };
      const info: JwtPayload = {
        email: 'test@example.com',
        name: 'John Doe',
        password: 'password123',
        phone_number: '1234567890',
        school_limit: 5,
        iat: 1234567890,
        exp: 1234567890,
      };

      const jwtPayload = { info };

      const mockJwtPayload: JwtPayload = { credential: 'mockCredential' };
      const mockToken = 'mockToken';

      const mockTrustee = {
        // Mocked trustee data
        _id: new Types.ObjectId(),
        name: 'John Doe',
        email_id: 'john@example.com',
        password_hash: 'hashedPassword',
        school_limit: 10,
        phone_number: '1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0,
      };

      jest.spyOn(jwtService, 'verify').mockReturnValueOnce(info);
      jest
        .spyOn(service, 'createTrustee')
        .mockResolvedValueOnce(mockTrustee as any);
      jest.spyOn(jwtService, 'sign').mockReturnValueOnce(mockToken);

      // Act
      const result = await controller.createTrustee(mockData);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith(mockData.data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      expect(service.createTrustee).toHaveBeenCalledWith(info);
      expect(jwtService.sign).toHaveBeenCalledWith(
        { credential: mockTrustee },
        { secret: process.env.JWT_SECRET_FOR_INTRANET },
      );
      expect(result).toEqual(mockToken);
    });
    it('should throw ConflictException if email already exists', async () => {
      // Mock data
      const mockData = { data: 'mockData' };
      const info: JwtPayload = {
        email: 'test@example.com',
        name: 'John Doe',
        password: 'password123',
        phone_number: '1234567890',
        school_limit: 5,
        iat: 1234567890,
        exp: 1234567890,
      };

      const conflictError = new ConflictException('Email already exists');

      jest.spyOn(jwtService, 'verify').mockReturnValue(info);
      jest.spyOn(service, 'createTrustee').mockRejectedValue(conflictError);

      // Act and Assert
      await expect(controller.createTrustee(mockData)).rejects.toThrow(
        ConflictException,
      );

      // Ensure that the methods were called with the expected parameters
      expect(jwtService.verify).toHaveBeenCalledWith(mockData.data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      expect(service.createTrustee).toHaveBeenCalledWith(info);
    });

    it('should throw BadRequestException for other errors', async () => {
      // Mocking the behavior of jwtService.verify that throws an exception
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw { message: 'Bad Request' };
      });
      const info = {
        email: 'some@mail.com',
        name: 'new trustee',
        password: 'password',
        phone_number: '4564569875',
        school_limit: 150,
        iat: 1704643606,
        exp: 1704650806,
      } as JwtPayload;

      // Execute the method and assert
      await expect(
        controller.createTrustee({ data: 'mockData' }),
      ).rejects.toThrowError(BadRequestException);
    });
  });

  describe('findTrustee', () => {
    it('should return arrays of trustee', async () => {
      const mockPage = 1;
      const mockPageSize = 10;
      const paginationToken = 'pagToken';
      const pagInfo = {
        mockPage: 1,
        mockPageSize: 10,
      };
      const mockTrusteeData = [
        {
          _id: new Types.ObjectId(),
          name: 'John Doe',
          email_id: 'john@example.com',
          password_hash: 'hashedPassword',
          school_limit: 10,
          phone_number: '1234567890',
          createdAt: new Date(),
          updatedAt: new Date(),
          __v: 0,
        },
      ];
      const mockToken = 'mockToken';
      mockMainbackenService.findTrustee.mockResolvedValueOnce(mockTrusteeData);
      MockJwtService.verify.mockReturnValueOnce(pagInfo);
      MockJwtService.sign.mockReturnValueOnce(mockToken);
      const result = await controller.findTrustee(paginationToken);
      expect(MockJwtService.sign).toHaveBeenCalledWith(mockTrusteeData, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      expect(result).toEqual(mockToken);
    });
  });
  describe('updatedSchool', () => {
    it('shoulld update School', async () => {
      const school = await new trusteeSchoolModel({
        school_id: new Types.ObjectId('658e759736ba0754ca45d0c2'),
        trustee_id: new Types.ObjectId('658e759736ba0754ca45d0c1'),
        school_name: 'XYZ School',
      }).save();

      const mockdata = {
        school_id: school.school_id,
        trustee_id: school.trustee_id,
        client_id: 'client_id',
        merchantName: 'merchantName',
        merchantEmail: 'merchantemail@edviron.com',
        merchantStatus: MerchantStatus.NOT_INITIATED,
        pgMinKYC: MinKycStatus.MIN_KYC_PENDING,
        pgFullKYC: FullKycStatus.FULL_KYC_PENDING
      }

      const updatedSchool = await trusteeSchoolModel.findOneAndUpdate(
        { school_id: school.school_id },
        {
          $set: {
            client_id: mockdata.client_id,
            merchantEmail: mockdata.merchantEmail,
            merchantName: mockdata.merchantName,
            merchantStatus: mockdata.merchantStatus,
            pgFullKYC: mockdata.pgFullKYC,
            pgMinKYC: mockdata.pgMinKYC,
            trustee_id: school.trustee_id,
          },
        },
      );

      MockJwtService.verify.mockResolvedValueOnce(mockdata);
      jest
        .spyOn(service, 'updateSchoolInfo')
        .mockResolvedValueOnce({ updatedSchool });

      const body = { token: 'mockToken' };
      const result = await controller.updateSchool(body);
      const expectedResult = {
        school_id: school.school_id,
        school_name: school.school_name,
        msg: `${school.school_name} is Updated`,
      };
      expect(result).toEqual(expectedResult);
    });
    it('shoud throw BadRequestException on missing fields', async () => {
      const mockToken = 'mockToken';
      const mockdata = {
        school_name: 'mock School Name',
        school_id: '658e759736ba0754ca45d0c2',
        trustee_id: '658e759736ba0754ca45d0c1',
        client_id: 'client_id',
        client_secret: 'client_secret',
        merchantId: 'merchantId',
        merchantName: 'merchantName',
        merchantStatus: MerchantStatus.NOT_INITIATED,
        pgMinKYC: MinKycStatus.MIN_KYC_PENDING,
        pgFullKYC: FullKycStatus.FULL_KYC_PENDING
      }
      MockJwtService.verify.mockReturnValueOnce(mockdata);
      await expect(
        async () => await controller.updateSchool({ token: mockToken }),
      ).rejects.toThrowError(BadRequestException);
    });
    it('should throw BadRequestException for other errors', async () => {
      const mockToken = 'mockToken';

      jest
        .spyOn(service, 'updateSchoolInfo')
        .mockRejectedValueOnce({ message: 'Bad Request' });

      await expect(
        controller.updateSchool({ token: mockToken }),
      ).rejects.toThrowError(BadRequestException);
      expect(service.updateSchoolInfo).toHaveBeenCalled();
    });
  });
});

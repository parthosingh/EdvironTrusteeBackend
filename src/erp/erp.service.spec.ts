import { Test, TestingModule } from '@nestjs/testing';
import { ErpService } from './erp.service';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import { Connection, connect, Model, Types, Schema } from 'mongoose';
import { ObjectId } from 'mongoose';
import mongoose from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { SchoolSchema, TrusteeSchool } from '../schema/school.schema';
import { JwtModule, JwtService } from '@nestjs/jwt';
require('dotenv').config();
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException, 
} from '@nestjs/common';
import { Mode } from 'fs';
import { SettlementReport } from '../schema/settlement.schema';

jest.mock('@nestjs/jwt');

const mockToken = 'mocktoken';
const trustee_id = '658e759736ba0754ca45d0c2';

const MockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockTrustee = {
  _id: '658e759736ba0754ca45d0c2',
  name: 'John Doe',
  email_id: 'johndoe@example.com',
  school_limit: 50,
  IndexOfApiKey: 3,
  phone_number: 1234567890,
  apiKey: 'prevKey',
  save: jest.fn().mockReturnThis(),
};

let model: Model<Trustee>;
let service: ErpService;
let mongod: MongoMemoryServer;

describe('ErpService', () => {
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let trusteeModel: Model<Trustee>;
  let trusteeSchoolModel: Model<TrusteeSchool>;
  let service: ErpService;
  let jwtService: JwtService;
  let settlementModel: Model<SettlementReport>;

  const mockStudent = {
    _id: '658e759736ba0754ca45d0a4',
    name: 'prashantNew20:48',
    phone_number: "9490293203",
    class: '10th',
    section: 2,
    category: 'OBC',
    dob: '2023-12-31T23:59:59.999+00:00',
    gender: 'male',
    father_name: 'Hitesh Bansal',
    school_generated_id: '63ff2138742d8bdfbc91d4f7',
    school_id: '63ff2138742d8bdfbc91d4c6',
  };

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
      providers: [
        ErpService,
        { provide: Connection, useValue: {} },
        { provide: getModelToken(Trustee.name), useValue: trusteeModel },
        {
          provide: getModelToken(TrusteeSchool.name),
          useValue: trusteeSchoolModel,
        },
        {
          provide: getModelToken(SettlementReport.name),
          useValue: settlementModel,
        },
        { provide: JwtService, useValue: MockJwtService }, // Provide the mockJwtService
      ],
      imports: [JwtModule, SettlementReport],
    }).compile();

    service = module.get<ErpService>(ErpService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('genrateLink', () => {
    it('should return paymentlink', async () => {
      const expectedPaymentLink = 'paymentlink'; //payment link
      const phone_number = '7000000000';
      const mockResonse = { data: expectedPaymentLink };

      // Mock the sign method of jwtService
      jest.spyOn(jwtService, 'sign').mockImplementation(() => mockToken);

      jest.spyOn(jwtService, 'verify').mockReturnValue(mockResonse);

      // Mock the axios.get method to return the expected response
      jest.spyOn(axios, 'get').mockResolvedValue(mockResonse);

      const result = await service.genrateLink(phone_number);

      expect(result).toBe(mockResonse);

      expect(MockJwtService.sign).toHaveBeenCalledWith(
        { phone_number },
        { secret: process.env.JWT_SECRET_FOR_INTRANET, expiresIn: '2h' },
      );

      // Verify that axios.get was called with the correct URL
      expect(axios.get).toHaveBeenCalledWith(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/payment-link?token=${mockToken}`,
      );
    });
    const mockAxiosError = new Error('Axios Error');

    it('should throw BadGatewayException', async () => {
      // Mock the sign method of jwtService
      const phone_number = '7000000000';
      jest.spyOn(MockJwtService, 'sign').mockImplementation(() => mockToken);

      // Mock the axios.get method to simulate an error
      jest.spyOn(axios, 'get').mockRejectedValue(mockAxiosError);

      // Use 'await' and 'expect().rejects.toThrow()' to handle the asynchronous rejection
      await expect(service.genrateLink(phone_number)).rejects.toThrow(
        new BadGatewayException(mockAxiosError.message),
      );

      // Verify that MockJwtService.sign was called
      expect(MockJwtService.sign).toHaveBeenCalledWith(
        { phone_number },
        { secret: process.env.JWT_SECRET_FOR_INTRANET, expiresIn: '2h' },
      );

      // Verify that axios.get was called with the correct URL
      expect(axios.get).toHaveBeenCalledWith(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/payment-link?token=${mockToken}`,
      );
    });
  
  });

  describe('createSection', () => {
    it('should return created section', async () => {
      const school_id = '659459b5cc1f7c4a5eeee84d';
      const schoolId = new Types.ObjectId(school_id);
      const trusteeId = new Types.ObjectId(trustee_id);

      const data = {
        className: '4',
        section: 'Dy03',
      };

      const info = {
        school_id: schoolId,
        data: data,
      };

      const mockResonse = {
        section: {
          class: '4',
          section: 'D07',
          school_id: '659459b5cc1f7c4a5eeee84d',
          fine_per_day: 0,
          fine_grace_period: 7,
          fine_after_grace_period: 0,
          _id: '65857013b4f0da2269debfe1',
          createdAt: '2023-12-22T11:16:35.351Z',
          updatedAt: '2023-12-22T11:16:35.351Z',
          __v: 0,
        },
        iat: 7899456123,
      };
      const mockSection = {
        class: '4',
        section: 'D07',
        school_id: '659459a94ad03fe8bfbdf68c',
        fine_per_day: 0,
        fine_grace_period: 7,
        fine_after_grace_period: 0,
        _id: '65857013b4f0da2269debfe1',
        createdAt: '2023-12-22T11:16:35.351Z',
        updatedAt: '2023-12-22T11:16:35.351Z',
        __v: 0,
      };
      const id = new Object('658958aa0861d5fcb1225aa0');
      const mockSchool = {
        _id: id,
        school_id: schoolId,
        trustee_id: trusteeId,
        school_name: 'new School',
        createdAt: '2023-12-25T10:25:46.694Z',
        updatedAt: '2023-12-25T10:25:46.694Z',
        __v: 0,
      };

      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(true);

      jest.spyOn(jwtService, 'sign').mockReturnValue(mockToken);
      jest.spyOn(axios, 'post').mockResolvedValue({ data: mockToken });
      jest.spyOn(jwtService, 'verify').mockReturnValue(mockResonse);

      const result = await service.createSection(
        school_id,
        { className: '4', section: 'Dy03' },
        new Types.ObjectId('658e759736ba0754ca45d0c2'),
      );

      expect(trusteeSchoolModel.findOne).toHaveBeenCalledWith({
        trustee_id: trusteeId,
        school_id: schoolId,
      });
      await expect(jwtService.sign).toHaveBeenCalledWith(info, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
        expiresIn: '2h',
      });

      expect(axios.post).toHaveBeenCalledWith(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/section`,
        {
          token: mockToken,
        },
      );

      expect(result).toEqual(mockResonse);
    });

    it('should throw NotFoundException for school not found', async () => {
      const mockToken = 'mockToken';
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(null);
      const axiosPostMock = jest.spyOn(axios, 'post');
      axiosPostMock.mockRejectedValue({
        response: { status: 404, data: { message: 'School not found' } },
      });

      await expect(
        service.createSection(
          '658958aad47898892d4d975c',
          {},
          '658958aad47898892d4d976c',
        ),
      ).rejects.toThrow(NotFoundException);

      axiosPostMock.mockRestore();
    });

    it('should throw BadRequestException for invalid school ID format', async () => {
      // Arrange
      const invalidSchoolId = 'invalid_school_id';

      // Act & Assert
      await expect(
        service.createSection(invalidSchoolId, {}, 'trustee_id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when school is already have section', async () => {
      const school_id = '658958aad47898892d4d976c';
      const schoolId = new Types.ObjectId(school_id);
      const trusteeId = new Types.ObjectId(trustee_id);
      const axiosPostMock = jest.spyOn(axios, 'post');

      const data = {
        className: '4',
        section: 'D7',
      };

      const mockConflictResponse = {
        response: {
          status: 409,
          data: {
            statusCode: 409,
            message: 'Section already present',
          },
        },
      };

      jest.spyOn(MockJwtService, 'sign').mockImplementation(() => mockToken);
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(true);
      axiosPostMock.mockRejectedValueOnce(mockConflictResponse);

      await expect(
        service.createSection(schoolId, data, trusteeId),
      ).rejects.toThrow(ConflictException);

      axiosPostMock.mockRestore();
    });
  });


  describe('createSchool', () => {
    it('should return created school', async () => {
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c2');
      const mockInput = {
        name: 'Priyanshu',
        phone_number: '7000061777',
        email: 'some.school@school.com',
        school_name: 'Some School',
        trustee_id: new Types.ObjectId('658e759736ba0754ca45d0c2'),
      };
      const mockRes = {
        school_id: new Types.ObjectId('6598140760db7716cec6d79f'),
        trustee_id: new Types.ObjectId('658e759736ba0754ca45d0c2'),
        school_name: 'Some School',
        _id: new Types.ObjectId('659814071d02afd5f13a7a8e'),
        updatedAt: '2024-01-05T14:36:55.513Z',
        createdAt: '2024-01-05T14:36:55.513Z',
        __v: 0,
      };

      const school_id = '658958aad47898892d4d976c';
      jest.spyOn(trusteeSchoolModel,'countDocuments').mockResolvedValueOnce(30)
      jest.spyOn(trusteeModel,'findById').mockResolvedValueOnce(mockTrustee)
      jest.spyOn(jwtService, 'sign').mockReturnValue('mocktoken');
      jest.spyOn(axios, 'post').mockResolvedValue({ data: 'axiosToken' });
      const mockVerifyToken = {
        adminInfo: {
          _id: '65980d4360db7716cec6d6cf',
          school_id: '658958aad47898892d4d976c',
        },
        updatedSchool: {
          school_id: '658958aad47898892d4d976c',
          updates: { name: 'school name' },
        },
        iat: 1704463683,
      };
      jest.spyOn(jwtService, 'verify').mockReturnValue(mockVerifyToken);
      jest
        .spyOn(trusteeSchoolModel, 'create')
        .mockResolvedValue(mockRes as any);

      const trusteeobj = new Types.ObjectId('658e759736ba0754ca45d0c2');
      const result = await service.createSchool(
        mockInput.phone_number,
        mockInput.name,
        mockInput.email,
        mockInput.school_name,
        trusteeobj as any,
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          phone_number: mockInput.phone_number,
          name: mockInput.name,
          email: mockInput.email,
          school_name: mockInput.school_name,
        },
        {
          secret: process.env.JWT_SECRET_FOR_INTRANET,
          expiresIn: '2h',
        },
      );
      expect(axios.post).toHaveBeenCalledWith(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/create-school`,
        {
          token: mockToken,
        },
      );

      expect(jwtService.verify).toHaveBeenCalledWith(mockToken, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      expect(trusteeSchoolModel.create).toHaveBeenCalledWith({
        school_id: new Types.ObjectId(school_id),
        school_name: 'school name',
        trustee_id: new Types.ObjectId('658e759736ba0754ca45d0c2'),
      });
      expect(result).toEqual(mockVerifyToken);
    });
    it('should throw ConflictException', async () => {
      const axiosPostMock = jest.spyOn(axios, 'post');
      const mockConflictResponse = {
        response: {
          status: 409,
          data: {
            statusCode: 409,
            message: 'Invalid phone number!',
          },
        },
      };
      jest.spyOn(MockJwtService, 'sign').mockImplementation(() => mockToken);
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(true);
      jest.spyOn(trusteeSchoolModel,'countDocuments').mockResolvedValueOnce(30)
      jest.spyOn(trusteeModel,'findById').mockResolvedValueOnce(mockTrustee)
      axiosPostMock.mockRejectedValueOnce(mockConflictResponse);
      const mockInput = {
        name: 'Priyanshu',
        phone_number: '7000061777',
        email: 'some.school@school.com',
        school_name: 'Some School',
        trustee_id: new Types.ObjectId('658e759736ba0754ca45d0c2'),
      };
      const trusteeobj = new Types.ObjectId('658e759736ba0754ca45d0c2');
      await expect(
        service.createSchool(
          mockInput.phone_number,
          mockInput.name,
          mockInput.email,
          mockInput.school_name,
          trusteeobj as any,
        ),
      ).rejects.toThrow(ConflictException);
    });
    it('should throw invalid email', async () => {
      const mockInput = {
        name: 'Priyanshu',
        phone_number: 'invalid_phone',
        email: 'some.school@school.com',
        school_name: 'Some School',
        trustee_id: new Types.ObjectId('658e759736ba0754ca45d0c2'),
      };
      const axiosPostMock = jest.spyOn(axios, 'post');
      const mockConflictResponse = {
        response: {
          status: 409,
          data: {
            statusCode: 409,
            message: 'Invalid email!',
          },
        },
      };
      jest.spyOn(MockJwtService, 'sign').mockImplementation(() => mockToken);
      jest.spyOn(trusteeSchoolModel,'countDocuments').mockResolvedValueOnce(30)
      jest.spyOn(trusteeModel,'findById').mockResolvedValueOnce(mockTrustee)
      axiosPostMock.mockRejectedValueOnce(mockConflictResponse);

      // Act & Assert
      await expect(
        service.createSchool(
          mockInput.phone_number,
          mockInput.name,
          mockInput.email,
          mockInput.school_name,
          mockInput.trustee_id as any,
        ),
      ).rejects.toThrow(ConflictException);
    });
    it('should throw BadRequestException for invalid phone number', async () => {
      const axiosPostMock = jest.spyOn(axios, 'post');
      const mockBadRequestResponse = {
        response: {
          status: 404,
          data: {
            statusCode: 404,
            message: 'Invalid phone number!',
          },
        },
      };
      jest.spyOn(MockJwtService, 'sign').mockImplementation(() => mockToken);
      jest.spyOn(trusteeSchoolModel,'countDocuments').mockResolvedValueOnce(30)
      jest.spyOn(trusteeModel,'findById').mockResolvedValueOnce(mockTrustee)
      axiosPostMock.mockRejectedValueOnce(mockBadRequestResponse);
    
      const mockInput = {
        name: 'Priyanshu',
        phone_number: 'invalid_phone',
        email: 'some.school@school.com',
        school_name: 'Some School',
        trustee_id: new Types.ObjectId('658e759736ba0754ca45d0c2'),
      };
      const trusteeobj = new Types.ObjectId('658e759736ba0754ca45d0c2');
    
      await expect(
        service.createSchool(
          mockInput.phone_number,
          mockInput.name,
          mockInput.email,
          mockInput.school_name,
          trusteeobj as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
    it('should throw BadRequestException for invalid email address', async () => {
      const axiosPostMock = jest.spyOn(axios, 'post');
      const mockBadRequestResponse = {
        response: {
          status: 404,
          data: {
            statusCode: 404,
            message: 'Invalid email!',
          },
        },
      };
      jest.spyOn(MockJwtService, 'sign').mockImplementation(() => mockToken);
      jest.spyOn(trusteeSchoolModel,'countDocuments').mockResolvedValueOnce(30)
      jest.spyOn(trusteeModel,'findById').mockResolvedValueOnce(mockTrustee)
      axiosPostMock.mockRejectedValueOnce(mockBadRequestResponse);
    
      const mockInput = {
        name: 'Priyanshu',
        phone_number: 'invalid_phone',
        email: 'some.school@school.com',
        school_name: 'Some School',
        trustee_id: new Types.ObjectId('658e759736ba0754ca45d0c2'),
      };
      const trusteeobj = new Types.ObjectId('658e759736ba0754ca45d0c2');
    
      await expect(
        service.createSchool(
          mockInput.phone_number,
          mockInput.name,
          mockInput.email,
          mockInput.school_name,
          trusteeobj as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
    it('should throw BadRequestException for other invalid requests', async () => {
      const axiosPostMock = jest.spyOn(axios, 'post');
      const mockBadRequestResponse = {
        response: {
          status: 400,
          data: {
            statusCode: 400,
            message: 'Some other invalid request message',
          },
        },
      };
      jest.spyOn(MockJwtService, 'sign').mockImplementation(() => mockToken);
      jest.spyOn(trusteeSchoolModel,'countDocuments').mockResolvedValueOnce(30)
      jest.spyOn(trusteeModel,'findById').mockResolvedValueOnce(mockTrustee)
      axiosPostMock.mockRejectedValueOnce(mockBadRequestResponse);
    
      const mockInput = {
        name: 'Priyanshu',
        phone_number: '7000061777',
        email: 'some.school@school.com',
        school_name: 'Some School',
        trustee_id: new Types.ObjectId('658e759736ba0754ca45d0c2'),
      };
      const trusteeobj = new Types.ObjectId('658e759736ba0754ca45d0c2');
    
      await expect(
        service.createSchool(
          mockInput.phone_number,
          mockInput.name,
          mockInput.email,
          mockInput.school_name,
          trusteeobj as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUser', () => {
    it('should retuen all user', async () => {
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c2');

      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(mockTrustee);

      const userInfo = {
        name: mockTrustee.name,
        email_id: mockTrustee.email_id,
        phone_number: mockTrustee.phone_number,
      };

      const result = await service.getUser(trusteeId as any);

      expect(trusteeModel.findById).toHaveBeenCalledWith(trusteeId);
      expect(result).toEqual(userInfo);
    });
    it('should throw not found error', async () => {
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c2');

      jest
        .spyOn(trusteeModel, 'findById')
        .mockRejectedValue(new ConflictException('Some error'));

      // Act & Assert
      await expect(service.getUser(trusteeId as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });


  describe('createApiKey', () => {
    it('should create and return an api key', async () => {
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(mockTrustee);
      jest.spyOn(jwtService, 'sign').mockReturnValue('sampledApiKey');
      const apiKey = await service.createApiKey(mockTrustee._id);
      expect(trusteeModel.findById).toHaveBeenCalledWith(mockTrustee._id, {
        password_hash: 0,
      });
      expect(apiKey).toEqual('sampledApiKey');
      expect(mockTrustee.IndexOfApiKey).toBe(4);
      expect(mockTrustee.apiKey).toEqual('iKey');
    });
    it('should throw BadRequestException when an invalid trusteeId input is provided', async () => {
      const invalidTrusteeId = 'invalidId';
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(null);

      await expect(service.createApiKey(invalidTrusteeId)).rejects.toThrow(
        BadRequestException,
      );
    });
    it('should throw NotFoundException when Trustee is not found', async () => {
      const mockId = Types.ObjectId.createFromHexString(
        '658e759736ba0754ca45d0b3',
      ).toHexString();
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(null);

      await expect(service.createApiKey(mockId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });


  describe('createStudent', () => {
    it('should create a new student', async () => {
      const mockCreatedStudentData = { _id: '658e759736ba0754ca36d0c2' };
      const schoolId = new Types.ObjectId(mockStudent.school_id);
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(true);

      const mockInfo = {
        schoolId: schoolId,
        ...mockStudent,
      };
      jest.spyOn(jwtService, 'sign').mockReturnValue('mockedTokenToSend');

      jest.spyOn(axios, 'post').mockResolvedValue('mockedReturnDataToken');

      jest.spyOn(jwtService, 'verify').mockReturnValue(mockCreatedStudentData);
      const result = await service.createStudent(
        mockStudent,
        schoolId,
        mockTrustee._id,
      );
      expect(trusteeSchoolModel.findOne).toHaveBeenCalledWith({
        trustee_id: mockTrustee._id,
        school_id: schoolId,
      });
      expect(jwtService.sign).toHaveBeenCalledWith(mockInfo, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
        expiresIn: '2h',
      });
      expect(axios.post).toHaveBeenCalledWith(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/createStudent`,
        {
          token: 'mockedTokenToSend',
        },
      );
      expect(result).toEqual(mockCreatedStudentData);
    });
    it('should throw NotFoundException when school is not found for the trustee', async () => {
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(null);

      await expect(
        service.createStudent(
          mockStudent,
          mockStudent.school_id,
          mockTrustee._id,
        ),
      ).rejects.toThrow(NotFoundException);
    });
    it('should throw BadRequestException on 400 response from the API', async () => {
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(true);
      jest
        .spyOn(axios, 'post')
        .mockRejectedValue({ response: { status: 400, data: {} } });
      await expect(
        service.createStudent(
          mockStudent,
          mockStudent.school_id,
          mockTrustee._id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
    it('should throw NotfoundException on 404 response from the API', async () => {
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(true);
      jest
        .spyOn(axios, 'post')
        .mockRejectedValue({ response: { statusCode: 404, data: {} } });

      await expect(
        service.createStudent(
          mockStudent,
          mockStudent.school_id,
          mockTrustee._id,
        ),
      ).rejects.toThrow(NotFoundException);
    });
    it('should throw ConflictException on 409 response from the API', async () => {
      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValue(true);
      const mockConflictResponse = {
        response: {
          status: 409,
          data: {
            statusCode: 409,
          },
        },
      };
      jest.spyOn(axios, 'post').mockRejectedValue(mockConflictResponse);
      await expect(
        service.createStudent(
          mockStudent,
          mockStudent.school_id,
          mockTrustee._id,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });


  describe('validateApiKey',()=>{
    it('should retutn trustee after valodation',async()=>{
      const trusteeId = new Types.ObjectId('658e759736ba0754ca45d0c2');
      const apiKey = 'validApiKey';
      const mockTrustee = {
        name: 'test 001',
        email_id: 'one@gmail',
        password_hash: '$2b$10$.ykb8jlprPpauXQl6pK2jePMPVl6XI0qxjLF6chZHY8dF0T/zNW76',
        school_limit: 150,
        IndexOfApiKey: 30,
        phone_number: '444444444',
        _id: trustee_id,
        createdAt: "2024-01-05T12:10:10.300Z",
        updatedAt: "2024-01-05T12:10:10.300Z",
        __v: 0
      };
      const mockDecodedPayload = {
        trusteeId: trusteeId,
        IndexOfApiKey: 30,
      };
      

      jest.spyOn(jwtService, 'verify').mockReturnValue(mockDecodedPayload);
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(mockTrustee);

      const result = await service.validateApiKey(apiKey);

      expect(jwtService.verify).toHaveBeenCalledWith(apiKey, {
        secret: process.env.JWT_SECRET_FOR_API_KEY,
      });
      expect(trusteeModel.findById).toHaveBeenCalledWith(mockDecodedPayload.trusteeId);
      expect(result).toEqual( {
        id: '658e759736ba0754ca45d0c2',
        name: 'test 001',
        email: 'one@gmail'
      })
    })
  })


});

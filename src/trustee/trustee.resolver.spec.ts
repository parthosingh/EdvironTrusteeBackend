import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, Model, Schema, Types } from 'mongoose';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import { getModelToken } from '@nestjs/mongoose';
import { SchoolSchema, TrusteeSchool } from '../schema/school.schema';
import { TrusteeService } from './trustee.service';
import { ErpService } from '../erp/erp.service';
import { TrusteeResolver } from './trustee.resolver';
import { JwtService } from '@nestjs/jwt';
import { ObjectId } from 'mongodb';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { MainBackendService } from '../main-backend/main-backend.service';
import { SettlementReport, SettlementSchema } from '../schema/settlement.schema';
import axios, { AxiosError } from 'axios';
import { error } from 'console';

describe('TrusteeResolver', () => {
  let resolver: TrusteeResolver;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let trusteeModel: Model<Trustee>;
  let trusteeSchoolModel: Model<TrusteeSchool>;
  let erpService: ErpService;
  let service: TrusteeService;
  let mainbackendService: MainBackendService;
  let settlementModel: Model<SettlementReport>;

  const mockTrustee = {
    _id: '658e759736ba0754ca45d0c2',
    name: 'John Doe',
    email_id: 'johndoe@example.com',
    school_limit: 5,
    IndexOfApiKey: 3,
    phone_number: 1234567890,
    apiKey: 'sampledApiKey',
    save: jest.fn().mockReturnThis(),
  };
  const mockTrusteeSchools = [
    {
      school_id: new Schema.Types.ObjectId('6099438e651824001f168b50', {
        suppressWarning: true,
      }),
      trustee_id: new Schema.Types.ObjectId('6099438e651824001f168b51', {
        suppressWarning: true,
      }),
      school_name: 'School A',
      merchantId: 'merchantId',
      merchantName: 'merchantName',
      merchantEmail: 'merchantemail@edviron.com',
      merchantStatus: 'merchantStatus',
      pgMinKYC: 'pgMinKYC',
      pgFullKYC: 'pgFullKYC',


    },
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
    settlementModel = mongoConnection.model(SettlementReport.name, SettlementSchema)

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
        {
          provide: TrusteeService,
          useValue: {
            getSchools: jest.fn().mockResolvedValue(mockTrusteeSchools),
            loginAndGenerateToken: jest.fn(),
            generateSchoolToken: jest.fn(),
            validateTrustee: jest.fn()
          },
        },
        {
          provide: ErpService,
          useValue: { createApiKey: jest.fn() },
        },
        {
          provide: MainBackendService,
          useValue: { createApiKey: jest.fn(), generateKey: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn() },
        },
        {
          provide: getModelToken(SettlementReport.name),
          useValue: settlementModel,
        },
      ],
    }).compile();
    service = module.get<TrusteeService>(TrusteeService);
    erpService = module.get<ErpService>(ErpService);
    mainbackendService = module.get<MainBackendService>(MainBackendService);
    resolver = module.get<TrusteeResolver>(TrusteeResolver);
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
    expect(resolver).toBeDefined();
  });

  describe('getSchoolQuery', () => {
    it('should return school data and total pages', async () => {
      const mockPage = 1;
      const mockContext = { req: { trustee: mockTrustee._id } };
      const mockGetSchool: any = {
        schoolData: [
          { school_name: 'School 1', school_id: '1' },
          { school_name: 'School 2', school_id: '2' },
        ],
        total_pages: 3,
        page: 1,
      };

      jest.spyOn(service, 'getSchools').mockResolvedValue(mockGetSchool);

      const result = await resolver.getSchoolQuery(mockPage, mockContext);

      expect(service.getSchools).toHaveBeenCalledWith(
        mockTrustee._id,
        mockPage,
      );
      expect(result).toEqual({
        schools: mockGetSchool.schoolData,
        total_pages: mockGetSchool.total_pages,
        page: mockPage,
      });
    });
    it('should handle ConflictException and throw ConflictException', async () => {
      const mockTrusteeId = mockTrustee._id;
      const mockPage = 1;
      const mockContext = { req: { trustee: mockTrusteeId } };
      const mockError = new ConflictException('Conflict');
      jest.spyOn(service, 'getSchools').mockRejectedValue(mockError);

      await expect(
        resolver.getSchoolQuery(mockPage, mockContext),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle other errors and throw BadRequestException', async () => {
      const mockTrusteeId = 'trusteeId';
      const mockPage = 1;
      const mockContext = { req: { trustee: mockTrusteeId } };
      const mockError = new Error('Some error');
      jest.spyOn(service, 'getSchools').mockRejectedValue(mockError);

      await expect(
        resolver.getSchoolQuery(mockPage, mockContext),
      ).rejects.toThrow(BadRequestException);
    });
  });
  describe('createApiKey', () => {
    it('should create a new apiKey', async () => {
      const mockContext = {
        req: {
          trustee: '658e759736ba0754ca45d0c2',
        },
      };
      jest.spyOn(erpService, 'createApiKey').mockResolvedValue('mockedApiKey');
      const apiKey = await resolver.createApiKey(mockContext);
      expect(erpService.createApiKey).toHaveBeenCalledWith(
        mockContext.req.trustee,
      );
      expect(apiKey).toEqual({ key: 'mockedApiKey' });
    });
    it('should handle NotFoundException and throw', async () => {
      const mockContext = { req: { trustee: 'trustee_id' } };
      jest
        .spyOn(erpService, 'createApiKey')
        .mockRejectedValue(new NotFoundException());

      await expect(resolver.createApiKey(mockContext)).rejects.toThrow(
        NotFoundException,
      );
    });
    it('should handle other errors and throw BadRequestException', async () => {
      const mockContext = { req: { trustee: 'trustee_id' } };
      jest
        .spyOn(erpService, 'createApiKey')
        .mockRejectedValue(new Error('Some error'));

      await expect(resolver.createApiKey(mockContext)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
  describe('loginTrustee', () => {
    it('should return AuthResponse with token on successful login', async () => {
      const mockEmail = 'test@example.com';
      const mockPassword = 'password';
      const mockToken = 'mockToken';

      jest.spyOn(service, 'loginAndGenerateToken').mockResolvedValue({
        token: mockToken,
      });

      const result = await resolver.loginTrustee(mockEmail, mockPassword);

      expect(service.loginAndGenerateToken).toHaveBeenCalledWith(
        mockEmail,
        mockPassword,
      );
      expect(result).toEqual({ token: mockToken });
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      // Arrange
      const mockEmail = 'test@example.com';
      const mockPassword = 'invalidPassword';

      jest.spyOn(service, 'loginAndGenerateToken').mockRejectedValue(
        new UnauthorizedException(),
      );

      // Act & Assert
      await expect(
        resolver.loginTrustee(mockEmail, mockPassword),
      ).rejects.toThrowError('Invalid email or password');
    });

    it('should throw generic error message for other errors during login', async () => {
      // Arrange
      const mockEmail = 'test@example.com';
      const mockPassword = 'password';

      jest.spyOn(service, 'loginAndGenerateToken').mockRejectedValue(
        new Error('Some unexpected error'),
      );

      // Act & Assert
      await expect(
        resolver.loginTrustee(mockEmail, mockPassword),
      ).rejects.toThrowError('An error occurred during login');
    });
  });

  describe('generateSchoolToken', () => {
    it('should return SchoolTokenResponse with token and user on successful generation', async () => {
      // Arrange
      const mockSchoolId = 'school123';
      const mockPassword = 'password';
      const mockUserId = 'trustee456';
      const mockToken = 'mockToken';
      const mockUser = {
        _id: 'user123',
        name: 'John Doe',
        phone_number: '1234567890',
        email_id: 'john@example.com',
        access: 'admin',
        school_id: 'school123',
      };

      jest.spyOn(service, 'generateSchoolToken').mockResolvedValue({
        token: mockToken,
        user: mockUser,
      });

      // Act
      const result = await resolver.generateSchoolToken(
        mockSchoolId,
        mockPassword,
        { req: { trustee: mockUserId } },
      );

      // Assert
      expect(service.generateSchoolToken).toHaveBeenCalledWith(
        mockSchoolId,
        mockPassword,
        mockUserId,
      );
      expect(result).toEqual({
        token: mockToken,
        user: mockUser,
      });
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      // Arrange
      const mockSchoolId = 'school123';
      const mockPassword = 'invalidPassword';
      const mockUserId = 'trustee456';

      jest.spyOn(service, 'generateSchoolToken').mockRejectedValue(
        new UnauthorizedException(),
      );

      // Act & Assert
      await expect(
        resolver.generateSchoolToken(
          mockSchoolId,
          mockPassword,
          { req: { trustee: mockUserId } },
        ),
      ).rejects.toThrowError('Invalid password');
    });

    it('should throw NotFoundException for missing data', async () => {
      // Arrange
      const mockSchoolId = 'nonexistentSchool';
      const mockPassword = 'password';
      const mockUserId = 'trustee456';

      jest.spyOn(service, 'generateSchoolToken').mockRejectedValue(
        new NotFoundException(),
      );

      // Act & Assert
      await expect(
        resolver.generateSchoolToken(
          mockSchoolId,
          mockPassword,
          { req: { trustee: mockUserId } },
        ),
      ).rejects.toThrowError(NotFoundException);
    });

    it('should throw generic error message for other errors during token generation', async () => {
      // Arrange
      const mockSchoolId = 'school123';
      const mockPassword = 'password';
      const mockUserId = 'trustee456';

      jest.spyOn(service, 'generateSchoolToken').mockRejectedValue(
        new Error('Some unexpected error'),
      );

      // Act & Assert
      await expect(
        resolver.generateSchoolToken(
          mockSchoolId,
          mockPassword,
          { req: { trustee: mockUserId } },
        ),
      ).rejects.toThrowError('Error generating school token');
    });
  });

  describe('getUserQuery', () => {
    it('should return TrusteeUser on successful user retrieval', async () => {
      // Arrange
      const mockToken = 'mockToken';
      const mockTrustee = {
        id: 'trustee123',
        name: 'John Doe',
        email: 'john@example.com',
        apiKey: 'api123',
      };

      jest.spyOn(service, 'validateTrustee').mockResolvedValue(mockTrustee);

      // Act
      const result = await resolver.getUserQuery({ req: { headers: { authorization: `Bearer ${mockToken}` } } });

      // Assert
      expect(service.validateTrustee).toHaveBeenCalledWith(mockToken);
      expect(result).toEqual({
        _id: mockTrustee.id,
        name: mockTrustee.name,
        email_id: mockTrustee.email,
        apiKey: mockTrustee.apiKey,
      });
    });

    it('should throw ConflictException for conflict error', async () => {
      // Arrange
      const mockToken = 'mockToken';

      jest.spyOn(service, 'validateTrustee').mockRejectedValue(
        new ConflictException(),
      );

      // Act & Assert
      await expect(
        resolver.getUserQuery({ req: { headers: { authorization: `Bearer ${mockToken}` } } }),
      ).rejects.toThrowError(ConflictException);
    });

    it('should throw generic error message for other errors during user retrieval', async () => {
      // Arrange
      const mockToken = 'mockToken';

      jest.spyOn(service, 'validateTrustee').mockRejectedValue(
        new Error('Some unexpected error'),
      );

      // Act & Assert
      await expect(
        resolver.getUserQuery({ req: { headers: { authorization: `Bearer ${mockToken}` } } }),
      ).rejects.toThrowError(BadRequestException);
    });
  });
  describe('resetKey', () => {
    it('should reset pg_key', async () => {
      const schoolId = new Types.ObjectId(1).toHexString();
      const trusteeId = new Types.ObjectId(2).toHexString();
      const mockContext = { req: { trustee: trusteeId } };
      const mockSchool = {
        school_id: schoolId,
        trustee_id: trusteeId,
        school_name: 'School A',
        merchantId: 'merchantId',
        merchantName: 'merchantName',
        merchantEmail: 'merchantemail@edviron.com',
        merchantStatus: 'merchantStatus',
        pgMinKYC: 'pgMinKYC',
        pgFullKYC: 'pgFullKYC',
      };

      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValueOnce({
        ...mockSchool,
        save: jest.fn(), // Mock the save function
      });
      jest.spyOn(mainbackendService, 'generateKey').mockResolvedValueOnce('E234RTGLO0')
      const result = await resolver.resetKey(mockContext, schoolId);

      expect(result).toEqual({ pg_key: 'E234RTGLO0' });
      expect(mainbackendService.generateKey).toHaveBeenCalled();

    });
  });

  it('should get SettlementReports', async () => {

    const report = await new settlementModel({
      settlementAmount: 4000,
      adjustment: 400,
      netSettlementAmount: 200,
      fromDate: new Date(),
      tillDate: new Date(),
      status: "Pending",
      utrNumber: "446sadasf",
      settlementDate: new Date(),
      merchantId: "123456",
      trustee: new Types.ObjectId(1),
      schoolName: "XYZ School"
    }).save()
    await new settlementModel({
      settlementAmount: 4000,
      adjustment: 400,
      netSettlementAmount: 200,
      fromDate: new Date(),
      tillDate: new Date(),
      status: "Pending",
      utrNumber: "446sadasf",
      settlementDate: new Date(),
      merchantId: "123456",
      trustee: report.trustee,
      schoolName: "XYZ School"
    })

    let context = { req: { trustee: report.trustee } }
    const expectedResult = await settlementModel.find({ trustee: context.req.trustee })
    expect(await resolver.getSettlementReports(context)).toEqual(expectedResult);

  })

  it('should get transaction report', async () => {
    let context = { req: { trustee: new Types.ObjectId(1) } }
    const school = await new trusteeSchoolModel({
      trustee_id: context.req.trustee,
      merchantName: "Demo",
      client_id: "123456",
      school_id: new Types.ObjectId(2),
      school_name:"Example School",
    }).save()

    const transactionReport = {
      data: [{
        collect_id: "123456",
        updatedAt: "2024-03-11T12:00:00",
        order_amount: 50.25,
        transaction_amount: 45.75,
        payment_method: "Credit Card",
        school_name: "Example School",
        school_id: school.school_id,
        status: "Completed"
      }]
    }

    jest.spyOn(axios, "request").mockResolvedValueOnce(transactionReport)

    expect(await resolver.getTransactionReport(context)).toEqual(transactionReport.data);

  })

  it('should give error getting transaction report', async () => {
    let context = { req: { trustee: new Types.ObjectId(1) } }
    const school = await new trusteeSchoolModel({
      trustee_id: context.req.trustee,
      merchantName: "Demo",
      client_id: "123456",
      school_id: new Types.ObjectId(2),
      school_name:"Example School",
    }).save()

    jest.spyOn(axios, "request").mockRejectedValueOnce(new AxiosError())

    await expect(resolver.getTransactionReport(context)).rejects.toThrow(AxiosError);

  })

  it('should get all schools', async()=>{
    const trustee = new Types.ObjectId(1);
    let context = { req: { trustee: new Types.ObjectId(1) } }
    await new trusteeSchoolModel( {trustee_id: context.req.trustee,
      merchantName: "Demo",
      school_id: new Types.ObjectId(2),
      school_name:"Example School"}).save()
    await new trusteeSchoolModel({school_id:new Types.ObjectId(3), trustee_id:context.req.trustee, merchantName: "Demo 2",school_name:"Example School 2" })
    .save();

    const schools = await trusteeSchoolModel.find({trustee_id:context.req.trustee});

    expect(await resolver.getAllSchoolQuery(context)).toEqual(schools)
  })

  describe('kycLoginToken',()=>{
    it.only('should return kyc token',async()=>{
      const school_id = new ObjectId(1).toHexString();
    const mockResponse = {
      data:{
        token:'mockToken'
      }
    }

    jest.spyOn(axios,'get').mockResolvedValueOnce(mockResponse)
    const result = await resolver.kycLoginToken(school_id)
    expect(result).toMatchObject({token:mockResponse.data.token})
    })
  })
});

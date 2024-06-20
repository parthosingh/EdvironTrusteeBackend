import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, Model, Schema, Types, model } from 'mongoose';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import { getModelToken } from '@nestjs/mongoose';
import { FullKycStatus, MerchantStatus, MinKycStatus, SchoolSchema, TrusteeSchool } from '../schema/school.schema';
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
import {
  SettlementReport,
  SettlementSchema,
} from '../schema/settlement.schema';
import axios, { AxiosError } from 'axios';
import { error } from 'console';
import { TrusteeModule } from './trustee.module';
import {
  TrusteeMember,
  TrusteeMemberSchema,
} from '../schema/partner.member.schema';
import { EmailService } from '../email/email.service';

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
  let trusteeMemberModel: Model<TrusteeMember>;

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
      merchantStatus: MerchantStatus.NOT_INITIATED,
      pgMinKYC: MinKycStatus.MIN_KYC_PENDING,
      pgFullKYC: FullKycStatus.FULL_KYC_PENDING


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
    settlementModel = mongoConnection.model(
      SettlementReport.name,
      SettlementSchema,
    );
    trusteeMemberModel = mongoConnection.model(
      TrusteeMember.name,
      TrusteeMemberSchema,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrusteeResolver,
        ErpService,
        MainBackendService,
        TrusteeService,
        EmailService,
        { provide: getModelToken(Trustee.name), useValue: trusteeModel },
        {
          provide: getModelToken(TrusteeSchool.name),
          useValue: trusteeSchoolModel,
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
        {
          provide: getModelToken(TrusteeMember.name),
          useValue: trusteeMemberModel,
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
      const school_id_1 = new Types.ObjectId(11);
      const school2 = new Types.ObjectId(12);
      const school3 = new Types.ObjectId(13);
      const school4 = new Types.ObjectId(14);

      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          trustee: trustee._id,
        },
      };

      const new_school_1 = await new trusteeSchoolModel({
        school_id: school_id_1,
        trustee_id: trustee._id,
        pgMinKYC: 'MIN_KYC_APPROVED',
      }).save();
      const new_school_2 = await new trusteeSchoolModel({
        school_id: school3,
        trustee_id: trustee._id,
        pgMinKYC: 'MIN_KYC_APPROVED',
      }).save();
      const new_school_3 = await new trusteeSchoolModel({
        school_id: school4,
        trustee_id: trustee._id,
        pgMinKYC: 'MIN_KYC_PENDING',
      }).save();

      const result = await resolver.getSchoolQuery(context);
      const mockResponse = [
        {
          school_id: new_school_3.school_id,
          merchantStatus: 'Not Initiated',
        },
        {
          school_id: new_school_2.school_id,
          merchantStatus: 'Not Initiated',
        },
        {
          school_id: new_school_1.school_id,
          merchantStatus: 'Not Initiated',
        },
      ];
      expect(JSON.parse(JSON.stringify(result.schools))).toEqual(
        JSON.parse(JSON.stringify(mockResponse)),
      );
    });
    it('should handle ConflictException and throw ConflictException', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const mockTrusteeId = trustee._id;
      const mockPage = 1;
      const mockContext = { req: { trustee: mockTrusteeId } };
      const mockError = new ConflictException('Conflict');
      jest.spyOn(service, 'getSchools').mockRejectedValue(mockError);

      await expect(resolver.getSchoolQuery(mockContext)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw user not found', async () => {
      const trustee = new Types.ObjectId(11);
      const schoolid = new Types.ObjectId(16);
      const password = '123456';
      const context = {
        req: {
          trustee,
          role: 'owner',
        },
      };
      await expect(resolver.getSchoolQuery(context)).rejects.toThrow(
        new Error('User not found'),
      );
    });

    it('should handle other errors and throw BadRequestException', async () => {
      const mockTrusteeId = 'trusteeId';
      const mockPage = 1;
      const mockContext = { req: { trustee: mockTrusteeId } };
      const mockError = new Error('Some error');
      jest.spyOn(service, 'getSchools').mockRejectedValue(mockError);

      await expect(resolver.getSchoolQuery(mockPage)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createApiKey', () => {
    it('should create a new apiKey', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      jest.spyOn(erpService, 'createApiKey').mockResolvedValue('mockedApiKey');
      jest.spyOn(service, 'validateApidOtp').mockResolvedValueOnce(true);
      const apiKey = await resolver.createApiKey('11111', context);
      expect(erpService.createApiKey).toHaveBeenCalledWith(context.req.trustee);
      expect(apiKey).toEqual({ key: 'mockedApiKey' });
    });
    it('should handle NotFoundException and throw', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();

      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };
      const school1 = new Types.ObjectId(11);
      const mockContext = { req: { trustee: school1, role: 'owner' } };
      jest.spyOn(service, 'validateApidOtp').mockResolvedValueOnce(true);
      jest
        .spyOn(erpService, 'createApiKey')
        .mockRejectedValueOnce(new NotFoundException());

      await expect(resolver.createApiKey('11111', context)).rejects.toThrow(
        NotFoundException,
      );
    });
    it('should throw user not found', async () => {
      const trustee = new Types.ObjectId(11);
      const schoolid = new Types.ObjectId(16);
      const password = '123456';
      const context = {
        req: {
          trustee,
          role: 'owner',
        },
      };
      await expect(resolver.createApiKey('111111', context)).rejects.toThrow(
        new Error('User not found'),
      );
    });
    it('should handle other errors and throw BadRequestException', async () => {
      const mockContext = { req: { trustee: 'trustee_id', role: 'owner' } };
      jest
        .spyOn(erpService, 'createApiKey')
        .mockRejectedValue(new Error('Some error'));

      await expect(
        resolver.createApiKey('111111', mockContext),
      ).rejects.toThrow(BadRequestException);
    });
    it('should throw error if role !== owner', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          role: 'admin2',
          trustee: trustee._id,
        },
      };

      await expect(resolver.createApiKey('000000', context)).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
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

      jest
        .spyOn(service, 'loginAndGenerateToken')
        .mockRejectedValue(new UnauthorizedException());

      // Act & Assert
      await expect(
        resolver.loginTrustee(mockEmail, mockPassword),
      ).rejects.toThrowError('Invalid email or password');
    });

    it('should throw generic error message for other errors during login', async () => {
      // Arrange
      const mockEmail = 'test@example.com';
      const mockPassword = 'password';

      jest
        .spyOn(service, 'loginAndGenerateToken')
        .mockRejectedValue(new Error('Some unexpected error'));

      // Act & Assert
      await expect(
        resolver.loginTrustee(mockEmail, mockPassword),
      ).rejects.toThrowError('An error occurred during login');
    });
  });

  describe('generateSchoolToken', () => {
    it('should return SchoolTokenResponse with token and user on successful generation', async () => {
      const schoolid = new Types.ObjectId(14);
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      await new trusteeSchoolModel({
        school_id: schoolid,
        trustee_id: trustee._id,
        pgMinKYC: 'MIN_KYC_APPROVED',
      }).save();
      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };

      // Arrange
      const mockSchoolId = schoolid.toString();
      const mockPassword = 'password';
      const mockUserId = trustee._id;
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
        context,
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
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      jest
        .spyOn(service, 'generateSchoolToken')
        .mockRejectedValue(new UnauthorizedException());

      // Act & Assert
      await expect(
        resolver.generateSchoolToken(mockSchoolId, mockPassword, {
          req: { trustee: trustee._id },
        }),
      ).rejects.toThrowError('Invalid password');
    });

    it('should throw NotFoundException for missing data', async () => {
      // Arrange
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const mockSchoolId = 'nonexistentSchool';
      const mockPassword = 'password';
      const mockUserId = 'trustee456';

      jest
        .spyOn(service, 'generateSchoolToken')
        .mockRejectedValue(new NotFoundException());

      // Act & Assert
      await expect(
        resolver.generateSchoolToken(mockSchoolId, mockPassword, {
          req: { trustee: trustee._id, role: 'owner' },
        }),
      ).rejects.toThrowError(NotFoundException);
    });

    it('should throw user not found', async () => {
      const trustee = new Types.ObjectId(11);
      const schoolid = new Types.ObjectId(16);
      const password = '123456';
      const context = {
        req: {
          trustee,
          role: 'owner',
        },
      };
      await expect(
        resolver.generateSchoolToken(schoolid.toString(), password, context),
      ).rejects.toThrow(new Error('User not found'));
    });

    it('should throw generic error message for other errors during token generation', async () => {
      // Arrange
      const mockSchoolId = 'school123';
      const mockPassword = 'password';
      const mockUserId = 'trustee456';
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();

      jest
        .spyOn(service, 'generateSchoolToken')
        .mockRejectedValueOnce(new Error('Error generating school token'));

      // Act & Assert
      await expect(
        resolver.generateSchoolToken(mockSchoolId, mockPassword, {
          req: { trustee: trustee._id, role: 'owner' },
        }),
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
      const result = await resolver.getUserQuery({
        req: { headers: { authorization: `Bearer ${mockToken}` } },
      });

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

      jest
        .spyOn(service, 'validateTrustee')
        .mockRejectedValue(new ConflictException());

      // Act & Assert
      await expect(
        resolver.getUserQuery({
          req: { headers: { authorization: `Bearer ${mockToken}` } },
        }),
      ).rejects.toThrowError(ConflictException);
    });

    it('should throw generic error message for other errors during user retrieval', async () => {
      // Arrange
      const mockToken = 'mockToken';

      jest
        .spyOn(service, 'validateTrustee')
        .mockRejectedValue(new Error('Some unexpected error'));

      // Act & Assert
      await expect(
        resolver.getUserQuery({
          req: { headers: { authorization: `Bearer ${mockToken}` } },
        }),
      ).rejects.toThrowError(BadRequestException);
    });
  });
  describe('resetKey', () => {
    it('should reset pg_key', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const schoolId = new Types.ObjectId(1).toHexString();
      const trusteeId = new Types.ObjectId(2).toHexString();
      const mockContext = { req: { trustee: trustee._id, role: 'owner' } };
      const mockSchool = {
        school_id: schoolId,
        trustee_id: trusteeId,
        school_name: 'School A',
        merchantId: 'merchantId',
        merchantName: 'merchantName',
        merchantEmail: 'merchantemail@edviron.com',
        merchantStatus: MerchantStatus.NOT_INITIATED,
        pgMinKYC: MinKycStatus.MIN_KYC_PENDING,
        pgFullKYC: FullKycStatus.FULL_KYC_PENDING
      };

      jest.spyOn(trusteeSchoolModel, 'findOne').mockResolvedValueOnce({
        ...mockSchool,
        save: jest.fn(), // Mock the save function
      });
      jest
        .spyOn(mainbackendService, 'generateKey')
        .mockResolvedValueOnce('E234RTGLO0');
      const result = await resolver.resetKey(mockContext, schoolId);

      expect(result).toEqual({ pg_key: 'E234RTGLO0' });
      expect(mainbackendService.generateKey).toHaveBeenCalled();
    });
    it('should throw user not found', async () => {
      const trustee = new Types.ObjectId(11);
      const schoolid = new Types.ObjectId(16);
      const password = '123456';
      const context = {
        req: {
          trustee,
          role: 'owner',
        },
      };
      await expect(
        resolver.resetKey(context, schoolid.toString()),
      ).rejects.toThrow(new Error('User not found'));
    });
    it('should throw error if role !== owner', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const school1 = new Types.ObjectId(11);
      const context = {
        req: {
          role: 'admin2',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.resetKey(context, school1.toString()),
      ).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
      );
    });
  });

  describe('sentKycInvite', () => {
    it('send kyc mail', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const school1 = new Types.ObjectId(11);
      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };
      jest.spyOn(axios, 'post').mockResolvedValueOnce({ data: 'mocktoken' });
      const result = await resolver.sentKycInvite(
        'newschool',
        school1.toString(),
        context,
      );
      expect(result).toEqual('kyc invite sent');
    });
    it('should throw error if role !== owner', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const school1 = new Types.ObjectId(11);
      const context = {
        req: {
          role: 'admin2',
          trustee: trustee._id,
        },
      };
      jest.spyOn(axios, 'post').mockResolvedValueOnce({ data: 'mocktoken' });

      await expect(
        resolver.sentKycInvite('newschool', school1.toString(), context),
      ).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
      );
    });
  });

  it('should get SettlementReports', async () => {
    const trustee = await new trusteeModel({
      name: 'dummy',
      email_id: 'dummy@edviron.com',
      password_hash: 'dummy',
    }).save();

    const schoolId = new Types.ObjectId(119);
    const report = await new settlementModel({
      settlementAmount: 4000,
      adjustment: 400,
      netSettlementAmount: 200,
      fromDate: new Date(),
      tillDate: new Date(),
      status: 'Pending',
      utrNumber: '446sadasf',
      settlementDate: new Date(),
      merchantId: '123456',
      trustee: trustee._id,
      schoolId,
      clientId: 'client_id88',
      schoolName: 'XYZ School',
    }).save();

    let context = { req: { trustee: trustee._id, role: 'owner' } };
    const expectedResult = await settlementModel.find({
      trustee: context.req.trustee,
    });
    expect(await resolver.getSettlementReports(context)).toEqual(
      expectedResult,
    );
  });
  it('should throw error if user not found in settlements', async () => {
    const trustee = await new trusteeModel({
      name: 'dummy',
      email_id: 'dummy@edviron.com',
      password_hash: 'dummy',
    }).save();

    const trustee2 = new Types.ObjectId(119);
    let context = { req: { trustee: trustee2, role: 'owner' } };

    await expect(resolver.getSettlementReports(context)).rejects.toThrow(
      new Error('User not found'),
    );
  });

  it.skip('should get transaction report', async () => {
    const trustee = await new trusteeModel({
      name: 'dummy',
      email_id: 'dummy@edviron.com',
      password_hash: 'dummy',
    }).save();

    let context = { req: { trustee: trustee._id, role: 'owner' } };
    const school = await new trusteeSchoolModel({
      trustee_id: context.req.trustee,
      merchantName: 'Demo',
      client_id: '123456',
      school_id: new Types.ObjectId(2),
      school_name: 'Example School',
    }).save();

    const transactionReport = {
      data: [
        {
          collect_id: '123456',
          updatedAt: '2024-03-11T12:00:00',
          order_amount: 50.25,
          transaction_amount: 45.75,
          payment_method: 'Credit Card',
          school_name: 'Example School',
          school_id: school.school_id,
          status: 'Completed',
        },
      ],
    };

    jest.spyOn(axios, 'request').mockResolvedValueOnce(transactionReport);

    expect(await resolver.getTransactionReport(context)).toEqual(
      transactionReport.data,
    );
  });

  it('should throw error if user not found in transaction', async () => {
    const trustee = await new trusteeModel({
      name: 'dummy',
      email_id: 'dummy@edviron.com',
      password_hash: 'dummy',
    }).save();

    const trustee2 = new Types.ObjectId(119);
    let context = { req: { trustee: trustee2, role: 'owner' } };

    await expect(resolver.getTransactionReport(context)).rejects.toThrow(
      new Error('User not found'),
    );
  });

  it('should give error getting transaction report', async () => {
    const trustee = await new trusteeModel({
      name: 'dummy',
      email_id: 'dummy@edviron.com',
      password_hash: 'dummy',
    }).save();

    let context = { req: { trustee: trustee._id, role: 'owner' } };
    const school = await new trusteeSchoolModel({
      trustee_id: context.req.trustee,
      merchantName: 'Demo',
      client_id: '123456',
      school_id: new Types.ObjectId(2),
      school_name: 'Example School',
    }).save();

    jest.spyOn(axios, 'request').mockRejectedValueOnce(new AxiosError());

    await expect(resolver.getTransactionReport(context)).rejects.toThrow(
      AxiosError,
    );
  });

  it('should get all schools', async () => {
    const trustee = await new trusteeModel({
      name: 'dummy',
      email_id: 'dummy@edviron.com',
      password_hash: 'dummy',
    }).save();

    let context = { req: { trustee: trustee._id, role: 'owner' } };
    await new trusteeSchoolModel({
      trustee_id: context.req.trustee,
      merchantName: 'Demo',
      school_id: new Types.ObjectId(2),
      school_name: 'Example School',
    }).save();
    await new trusteeSchoolModel({
      school_id: new Types.ObjectId(3),
      trustee_id: context.req.trustee,
      merchantName: 'Demo 2',
      school_name: 'Example School 2',
    }).save();

    const schools = await trusteeSchoolModel.find({
      trustee_id: context.req.trustee,
    });

    expect(await resolver.getAllSchoolQuery(context)).toEqual(schools);
  });

  it('should throw error if user not found in get all school', async () => {
    const trustee = await new trusteeModel({
      name: 'dummy',
      email_id: 'dummy@edviron.com',
      password_hash: 'dummy',
    }).save();

    const trustee2 = new Types.ObjectId(119);
    let context = { req: { trustee: trustee2, role: 'owner' } };
    const expectedResult = await settlementModel.find({
      trustee: context.req.trustee,
    });
    await expect(resolver.getAllSchoolQuery(context)).rejects.toThrow(
      new Error('User not found'),
    );
  });

  describe('resetMails', () => {
    it('should send resetpassword mail', async () => {
      const email = 'dummymail@gmail.com';
      jest.spyOn(service, 'sentResetMail').mockResolvedValueOnce(true);
      const result = await resolver.resetMails(email);
      expect(result).toEqual({ active: true });
    });
  });

  describe('resetPassword', () => {
    it('should reset user password', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy123@edviron.com',
        password_hash: 'dummy',
      }).save();
      const oldTrustee = await trusteeModel.findById(trustee._id);
      const result = await resolver.resetPassword(trustee.email_id, '12345678');
      const newTrustee = await trusteeModel.findById(trustee._id);
      expect(oldTrustee.password_hash === newTrustee.password_hash).toEqual(
        false,
      );
      expect(result).toMatchObject({ msg: `Password Change` });
    });
  });

  describe('verifyToken', () => {
    it('should very token', async () => {
      jest.spyOn(service, 'verifyresetToken').mockResolvedValueOnce(true);
      expect(await resolver.verifyToken('mocktoken')).toMatchObject({
        active: true,
      });
    });
  });
  describe('kycLoginToken', () => {
    it('should return kyc token', async () => {
      const school_id = new ObjectId(1).toHexString();
      const context = {
        req: {
          role: 'owner',
        },
      };

      const mockResponse = {
        data: {
          token: 'mockToken',
        },
      };

      jest.spyOn(axios, 'get').mockResolvedValueOnce(mockResponse);
      const result = await resolver.kycLoginToken(school_id, context);
      expect(result).toMatchObject({ token: mockResponse.data.token });
    });
    it('throw UnauthorizedException if role !== owner', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy22@edviron.com',
        password_hash: 'dummy',
      }).save();
      const school_id = new ObjectId(1).toHexString();
      const context = {
        req: {
          role: 'management',
          trustee: trustee._id,
        },
      };

      await expect(resolver.kycLoginToken(school_id, context)).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
      );
    });
  });

  describe('partnerProfileData', () => {
    it('should return kyc details of schools', async () => {
      const school1 = new Types.ObjectId(11);
      const school2 = new Types.ObjectId(12);
      const school3 = new Types.ObjectId(13);
      const school4 = new Types.ObjectId(14);

      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();

      await new trusteeSchoolModel({
        school_id: school1,
        trustee_id: trustee._id,
        pgMinKYC: 'MIN_KYC_APPROVED',
      }).save();
      await new trusteeSchoolModel({
        school_id: school2,
        trustee_id: trustee._id,
      }).save();
      await new trusteeSchoolModel({
        school_id: school3,
        trustee_id: trustee._id,
        pgMinKYC: 'MIN_KYC_APPROVED',
      }).save();
      await new trusteeSchoolModel({
        school_id: school4,
        trustee_id: trustee._id,
        pgMinKYC: 'MIN_KYC_PENDING',
      }).save();

      const [totalSchool, active, inactive, pending] = await Promise.all([
        trusteeSchoolModel.countDocuments({ trustee_id: trustee._id }),
        trusteeSchoolModel.countDocuments({
          trustee_id: trustee._id,
          pgMinKYC: 'MIN_KYC_APPROVED',
        }),
        trusteeSchoolModel.countDocuments({
          trustee_id: trustee._id,
          pgMinKYC: { $in: ['Not Initiated', 'MIN_KYC_REJECTED', null] },
        }),
        trusteeSchoolModel.countDocuments({
          trustee_id: trustee._id,
          pgMinKYC: 'MIN_KYC_PENDING',
        }),
      ]);

      const response = {
        totalSchool,
        kycDetails: {
          active,
          pending,
          inactive,
        },
      };

      const context = {
        req: {
          trustee: trustee._id,
        },
      };
      const result = await resolver.partnerProfileData(context);

      expect(result).toMatchObject(response);
    });
    it('throw UnauthorizedException if role !== owner', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy22@edviron.com',
        password_hash: 'dummy',
      }).save();
      const school_id = new ObjectId(1).toHexString();
      const context = {
        req: {
          role: 'admin2',
          trustee: school_id,
        },
      };

      await expect(resolver.partnerProfileData(context)).rejects.toThrow(
        new Error('User not found'),
      );
    });
  });

  describe('updateTrustee', () => {
    it('should update trustee details', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      let context = { req: { trustee: trustee._id, role: 'owner' } };

      const name = 'raj';
      const email = 'demomail000@edviron.com';
      const phone_number = '1111111111';
      const password = 'dummy';

      const result = await resolver.updateTrustee(
        name,
        email,
        phone_number,
        password,
        context,
      );
      const newtrustee = await trusteeModel.findById(trustee._id);
      expect(newtrustee.name).toEqual(name);
      expect(result).toEqual('raj details updated successfully');
    });
    it('throw UnauthorizedException if role !== owner', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy22@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'd1emoma22il@edviron.com';
      const phone_number = '1212111111';
      const access = 'admin';
      const password = '123456';
      const context = {
        req: {
          role: 'admin2',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.updateTrustee(name, email, phone_number, password, context),
      ).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
      );
    });
    it('throw Error on missing field', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy22@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = null;
      const email = 'd1emoma22il@edviron.com';
      const phone_number = '1212111111';
      const password = '123456';
      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.updateTrustee(name, email, phone_number, password, context),
      ).rejects.toThrow(new Error('One or more required fields are missing.'));
    });
    it('throw Error if no user found', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy22@edviron.com',
        password_hash: 'dummy',
      }).save();
      const school_id = new ObjectId(1).toHexString();
      const name = 'null';
      const email = 'd1emoma22il@edviron.com';
      const phone_number = '1212111111';
      const password = '123456';
      const context = {
        req: {
          role: 'owner',
          trustee: school_id,
        },
      };

      await expect(
        resolver.updateTrustee(name, email, phone_number, password, context),
      ).rejects.toThrow(new NotFoundException('User Not found'));
    });
  });

  describe('createMember', () => {
    it('should create Member', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'demomail@edviron.com';
      const phone_number = '1111111111';
      const access = 'admin';
      const password = '123456';

      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      const result = await resolver.createMember(
        name,
        email,
        phone_number,
        access,
        password,
        context,
      );
      const member = await trusteeMemberModel.findOne({ email });
      expect(member).toBeDefined();
      expect(result).toEqual(`Member created Successfully`);
    });
    it('should throw error if role !== owner', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'demomail@edviron.com';
      const phone_number = '1111111111';
      const access = 'admin';
      const password = '123456';

      const context = {
        req: {
          role: 'admin2',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.createMember(
          name,
          email,
          phone_number,
          access,
          password,
          context,
        ),
      ).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
      );
    });

    it('should throw error if one or more field missing', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'demomail@edviron.com';
      const phone_number = '1111111111';
      const access = 'admin';
      const password = null;

      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.createMember(
          name,
          email,
          phone_number,
          access,
          password,
          context,
        ),
      ).rejects.toThrow(new Error('One or more required fields are missing.'));
    });

    it('should throw error if pass wrong role', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'demomail2@edviron.com';
      const phone_number = '1111111112';
      const access = 'owner';
      const password = '123456';

      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.createMember(
          name,
          email,
          phone_number,
          access,
          password,
          context,
        ),
      ).rejects.toThrow(new Error('Invalid access level provided.'));
    });

    it('should throw error on invalid email format', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'demomail2@edviron';
      const phone_number = '1111211112';
      const access = 'admin';
      const password = '123456';

      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.createMember(
          name,
          email,
          phone_number,
          access,
          password,
          context,
        ),
      ).rejects.toThrow(new Error('Invalid Email!'));
    });

    it('should throw error on invalid phone number format', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'demomail7@edviron.com';
      const phone_number = '111121';
      const access = 'admin';
      const password = '123456';

      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.createMember(
          name,
          email,
          phone_number,
          access,
          password,
          context,
        ),
      ).rejects.toThrow(new Error('Invalid phone number!'));
    });

    it('should throw error if found trustee with same email or number', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'dummy@edviron.com';
      const phone_number = '0000000000';
      const access = 'admin';
      const password = '123456';

      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.createMember(
          name,
          email,
          phone_number,
          access,
          password,
          context,
        ),
      ).rejects.toThrow(
        new ConflictException(
          'This email or phone number is already registered for a partner account. Please use a different email or phone number.',
        ),
      );
    });

    it('should throw error if found trustee with same email or number', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'dummy312@edviron.com';
      const phone_number = '0000000000';
      const access = 'admin';
      const password = '123456';
      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
      }).save();

      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.createMember(
          name,
          email,
          phone_number,
          access,
          password,
          context,
        ),
      ).rejects.toThrow(
        new ConflictException('Email or Phone Number is Taken'),
      );
    });
  });

  describe('getAllMembers', () => {
    it('should return all member of trustee', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      let context = { req: { trustee: trustee._id, role: 'owner' } };

      const name = 'raj';
      const email = 'demomail000@edviron.com';
      const phone_number = '1111111111';
      const access = 'admin';
      const password = '123456';

      await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
        trustee_id: trustee._id,
      }).save();

      const result = await resolver.getAllMembers(context);
      const response = await trusteeMemberModel.find({
        trustee_id: trustee._id,
      });

      expect(result[0]._id).toMatchObject(response[0]._id);
    });

    it('should throw error if role !== owner', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          role: 'admin2',
          trustee: trustee._id,
        },
      };

      await expect(resolver.getAllMembers(context)).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
      );
    });
  });

  describe('updateMemberDetails', () => {
    it('should update member', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy22@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'demoma22il@edviron.com';
      const phone_number = '1112111111';
      const access = 'admin';
      const password = '123456';

      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
        trustee_id: trustee._id,
      }).save();
      const user_id = member._id;

      const name2 = 'raj2';
      const email2 = 'demoma22il@2edviron.com';
      const phone_number2 = '1112111121';
      const access2 = 'admin';
      const password2 = '1234562';
      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      const result = await resolver.updateMemberDetails(
        name2,
        user_id.toString(),
        email2,
        phone_number2,
        context,
      );

      const checkupdate = await trusteeMemberModel.findById(member._id);
      expect(result).toEqual(`Member details updated successfully`);
      expect(checkupdate.name).toEqual(name2);
    });
    // it('throw Invalid access on invalid access',async()=>{
    //   const trustee = await new trusteeModel({ name: 'dummy', email_id: 'dummy22@edviron.com', password_hash: 'dummy' }).save()
    //   const name = 'raj'
    //   const email = 'd1emoma22il@edviron.com'
    //   const phone_number = '1212111111'
    //   const access = 'admin'
    //   const password = '123456'

    //   const member =await new trusteeMemberModel({
    //     name, email, phone_number, access, password_hash: password, trustee_id: trustee._id
    //   }).save()
    //   const user_id=member._id

    //   const name2 = 'raj2'
    //   const email2 = 'demoma22il@2edviron.com'
    //   const phone_number2 = '1112111121'
    //   const access2 = 'admin5'
    //   const password2 = '1234562'
    //   const context = {
    //     req: {
    //       role: 'owner',
    //       trustee: trustee._id
    //     }
    //   }

    //   await expect(resolver.updateMemberDetails(
    //     name2,
    //     user_id.toString(),
    //     email2,
    //     phone_number2,
    //     password2,
    //     context
    //   )).rejects.toThrow(new Error('Invalid access level provided.'))
    // })
    it('throw NotFoundException if no trustee found', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy22@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'd1emoma22il@edviron.com';
      const phone_number = '1212111111';
      const access = 'admin';
      const password = '123456';

      const newTrusteeId = new Types.ObjectId(11);

      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
        trustee_id: trustee._id,
      }).save();
      const user_id = member._id;

      const name2 = 'raj2';
      const email2 = 'demoma22il@2edviron.com';
      const phone_number2 = '1112111121';
      const access2 = 'admin';
      const password2 = '1234562';
      const context = {
        req: {
          role: 'owner',
          trustee: newTrusteeId,
        },
      };

      await expect(
        resolver.updateMemberDetails(
          name2,
          newTrusteeId.toString(),
          email2,
          phone_number2,
          password2,
        ),
      ).rejects.toThrow(new NotFoundException('User Not Found'));
    });
    it('throw UnauthorizedException if role !== owner', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy22@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'd1emoma22il@edviron.com';
      const phone_number = '1212111111';
      const access = 'management';
      const password = '123456';

      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
        trustee_id: trustee._id,
      }).save();
      const user_id = member._id;

      const name2 = 'raj2';
      const email2 = 'demoma22il@2edviron.com';
      const phone_number2 = '1112111121';
      const access2 = 'admin';
      const password2 = '1234562';
      const context = {
        req: {
          role: 'admin',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.updateMemberDetails(
          name2,
          trustee._id.toString(),
          email2,
          phone_number2,
          password2,
        ),
      ).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
      );
    });
    it('throw not found error if member is not found', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy22@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'd1emoma22il@edviron.com';
      const phone_number = '1212111111';
      const access = 'admin';
      const password = '123456';
      const newTrusteeId = new Types.ObjectId(11);

      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
        trustee_id: trustee._id,
      }).save();
      const user_id = member._id;

      const name2 = 'raj2';
      const email2 = 'demoma22il@2edviron.com';
      const phone_number2 = '1112111121';
      const access2 = 'admin';
      const password2 = '1234562';
      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.updateMemberDetails(
          name2,
          newTrusteeId.toString(),
          email2,
          phone_number2,
          password2,
        ),
      ).rejects.toThrow(new NotFoundException('Member Not Found'));
    });
    it('throw UnauthorizedException if another trustee try update member of anothers one', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy22@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'd1emoma22il@edviron.com';
      const phone_number = '1212111111';
      const access = 'admin';
      const password = '123456';
      const newTrusteeId = new Types.ObjectId(11);

      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
        trustee_id: newTrusteeId,
      }).save();
      const user_id = member._id;

      const name2 = 'raj2';
      const email2 = 'demoma22il@2edviron.com';
      const phone_number2 = '1112111121';
      const access2 = 'admin';
      const password2 = '1234562';
      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.updateMemberDetails(
          name2,
          user_id.toString(),
          email2,
          phone_number2,
          password2,
        ),
      ).rejects.toThrow(
        new UnauthorizedException('You are not Authorized to update this user'),
      );
    });
  });

  describe('deleteMember', () => {
    it('shoukld delete member', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'dummy44312@edviron.com';
      const phone_number = '4400000000';
      const access = 'admin';
      const password = '123456';
      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
      }).save();

      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };
      jest.spyOn(service, 'validateDeleteOtp').mockResolvedValueOnce(true);
      const result = await resolver.deleteMember(
        member._id.toString(),
        context,
      );
      const checkDelete = await trusteeMemberModel.findById(member._id);
      expect(checkDelete).toEqual(null);
      expect(result).toEqual(`${member.name} deleted Successfully`);
    });
  });

  describe('updateProfileDetails', () => {
    it('should update Profile info', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'dummy2';
      const brand_name = 'edviron';
      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };

      const result = await resolver.updateProfileDetails(
        name,
        brand_name,
        context,
      );
      const checkupdate = await trusteeModel.findById(trustee._id);
      expect(checkupdate.name).toEqual(name);
      expect(checkupdate.brand_name).toEqual(brand_name);
      expect(result).toEqual(`User updated successfully`);
    });
    it('throw UnauthorizedException if role !== owner', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy22@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'dummy2';
      const brand_name = 'edviron';
      const context = {
        req: {
          role: 'admin',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.updateProfileDetails(name, brand_name, context),
      ).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
      );
    });
    it('throw One or more required fields are missing.', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy22@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = null;
      const brand_name = 'edviron';
      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.updateProfileDetails(name, brand_name, context),
      ).rejects.toThrow(new Error('One or more required fields are missing.'));
    });
    it('throw user not found.', async () => {
      const trustee = new Types.ObjectId(14);
      const name = null;
      const brand_name = 'edviron';
      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };

      await expect(
        resolver.updateProfileDetails(name, brand_name, context),
      ).rejects.toThrow(new Error('User Not found'));
    });
  });

  describe('updateTrusteeMail', () => {
    it('should update trustee mail', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'qwerty@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };
      const email = 'newmail123@gmail.com';

      jest.spyOn(service, 'validateUpdateMailOtp').mockResolvedValueOnce(true);
      const result = await resolver.updateTrusteeMail(email, '878787', context);

      expect(result).toEqual(`Email  updated successfully`);
    });

    it('throw UnauthorizedException if role !== owner', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'qwerty@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          role: 'admin',
          trustee: trustee._id,
        },
      };
      const email = 'newmail123@gmail.com';

      jest.spyOn(service, 'validateUpdateMailOtp').mockResolvedValueOnce(true);
      await expect(
        resolver.updateTrusteeMail(email, '111', context),
      ).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
      );
    });
    it('throw One or more required fields are missing.', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'qwerty@edviron.com',
        password_hash: 'dummy',
      }).save();
      const id = new Types.ObjectId(11);
      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };
      const email = null;
      jest.spyOn(service, 'validateUpdateMailOtp').mockResolvedValueOnce(true);
      await expect(
        resolver.updateTrusteeMail(email, '1111', context),
      ).rejects.toThrow(new Error('One or more required fields are missing.'));
    });
    it('throw user not found.', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'qwerty@edviron.com',
        password_hash: 'dummy',
      }).save();
      const id = new Types.ObjectId(11);
      const context = {
        req: {
          role: 'owner',
          trustee: id,
        },
      };
      const email = 'emial@email.com';
      jest.spyOn(service, 'validateUpdateMailOtp').mockResolvedValueOnce(true);
      await expect(
        resolver.updateTrusteeMail(email, '1111', context),
      ).rejects.toThrow(new NotFoundException('User Not found'));
    });
    it.skip('throw Invalid otp.', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'qw55erty@edviron.com',
        password_hash: 'dummy',
      }).save();
      const id = new Types.ObjectId(11);
      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };
      const email = 'emial@email.com';
      // jest.spyOn(service,'sentUpdateOtpMail').mockResolvedValueOnce(true)
      await expect(
        resolver.updateTrusteeMail(email, '1111', context),
      ).rejects.toThrow(new Error('Invalid OTP '));
    });
  });

  describe('updateTrusteePhoneNumber', () => {
    it('should update trustee phone number', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'qwerty@edviron.com',
        password_hash: 'dummy',
      }).save();
      const id = new Types.ObjectId(11);
      const context = {
        req: {
          role: 'owner',
          trustee: trustee.id,
        },
      };
      jest.spyOn(service, 'validatePhoneNumberOtp').mockResolvedValueOnce(true);
      const result = await resolver.updateTrusteePhoneNumber(
        '1234509876',
        '9999',
        context,
      );
      const checkupdate = await trusteeModel.findById(trustee._id);
      expect(checkupdate.phone_number).toEqual('1234509876');
      expect(result).toEqual(`Phone Number updated successfully`);
    });

    it('throw error if role is not owner.', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'qwerty@edviron.com',
        password_hash: 'dummy',
      }).save();
      const id = new Types.ObjectId(11);
      const context = {
        req: {
          role: 'owner2',
          trustee: trustee.id,
        },
      };
      jest.spyOn(service, 'validatePhoneNumberOtp').mockResolvedValueOnce(true);
      await expect(
        resolver.updateTrusteePhoneNumber('1234509876', '9999', context),
      ).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
      );
    });
    it('throw error if field is missing.', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'qwerty@edviron.com',
        password_hash: 'dummy',
      }).save();
      const id = new Types.ObjectId(11);
      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };
      jest.spyOn(service, 'validatePhoneNumberOtp').mockResolvedValueOnce(true);
      await expect(
        resolver.updateTrusteePhoneNumber(null, '9999', context),
      ).rejects.toThrow(new Error('One or more required fields are missing.'));
    });
    it('throw error if user not found', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'qwerty@edviron.com',
        password_hash: 'dummy',
      }).save();
      const id = new Types.ObjectId(11);
      const context = {
        req: {
          role: 'owner',
          trustee: id,
        },
      };
      jest.spyOn(service, 'validatePhoneNumberOtp').mockResolvedValueOnce(true);
      await expect(
        resolver.updateTrusteePhoneNumber('1111111111', '9999', context),
      ).rejects.toThrow(new NotFoundException('User Not found'));
    });
    it.skip('throw error if otp is invalid.', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: '11212122234@edviron.com',
        password_hash: 'dummy',
      }).save();
      const id = new Types.ObjectId(11);
      const context = {
        req: {
          role: 'owner',
          trustee: trustee._id,
        },
      };
      jest
        .spyOn(service, 'validatePhoneNumberOtp')
        .mockResolvedValueOnce(false);
      await expect(
        resolver.updateTrusteePhoneNumber('0000870000', null, context),
      ).rejects.toThrow(new Error('Invalid OTP '));
    });
  });

  describe('updateAccessLevel', () => {
    it('should update access level', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'dummy312@edviron.com';
      const phone_number = '0000000000';
      const access = 'admin';
      const password = '123456';
      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
        trustee_id: trustee._id,
      }).save();

      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      const result = await resolver.updateAccessLevel(
        member._id.toString(),
        'management',
        context,
      );
      const checkupdate = await trusteeMemberModel.findById(member._id);
      expect(checkupdate.access).toEqual('management');
      expect(result).toEqual('Access Level updated');
    });
    it('throw error ', async () => {
      const id = new Types.ObjectId(11);
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'dummy312@edviron.com';
      const phone_number = '0000000000';
      const access = 'admin';
      const password = '123456';
      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
        trustee_id: trustee._id,
      }).save();

      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner3',
        },
      };
      await expect(
        resolver.updateAccessLevel(
          member._id.toString(),
          'management',
          context,
        ),
      ).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
      );
    });
    it('throw error ', async () => {
      const id = new Types.ObjectId(11);
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'dummy312@edviron.com';
      const phone_number = '0000000000';
      const access = 'admin';
      const password = '123456';
      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
        trustee_id: trustee._id,
      }).save();

      const context = {
        req: {
          trustee: id,
          role: 'owner',
        },
      };
      await expect(
        resolver.updateAccessLevel(
          member._id.toString(),
          'management',
          context,
        ),
      ).rejects.toThrow(new NotFoundException('User Not Found'));
    });

    it('throw error ', async () => {
      const id = new Types.ObjectId(11);
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'dummy312@edviron.com';
      const phone_number = '0000000000';
      const access = 'admin';
      const password = '123456';
      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
        trustee_id: trustee._id,
      }).save();

      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      await expect(
        resolver.updateAccessLevel(id.toString(), 'management', context),
      ).rejects.toThrow(new NotFoundException('Member Not Found'));
    });

    it('throw error ', async () => {
      const id = new Types.ObjectId(11);
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'dummy312@edviron.com';
      const phone_number = '0000000000';
      const access = 'admin';
      const password = '123456';
      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
        trustee_id: id,
      }).save();

      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      await expect(
        resolver.updateAccessLevel(
          member._id.toString(),
          'management',
          context,
        ),
      ).rejects.toThrow(
        new UnauthorizedException('You are not Authorized to update this user'),
      );
    });
    it('throw error ', async () => {
      const id = new Types.ObjectId(11);
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const name = 'raj';
      const email = 'dummy312@edviron.com';
      const phone_number = '0000000000';
      const access = 'admin';
      const password = '123456';
      const member = await new trusteeMemberModel({
        name,
        email,
        phone_number,
        access,
        password_hash: password,
        trustee_id: trustee._id,
      }).save();

      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      await expect(
        resolver.updateAccessLevel(member._id.toString(), 'dummy', context),
      ).rejects.toThrow(new Error('Invalid access level provided.'));
    });
  });

  describe('verifyPasswordOtp', () => {
    it('should verify passwordOtp', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      const oldData = await trusteeModel.findById(trustee._id);
      jest.spyOn(service, 'validatePasswordOtp').mockResolvedValueOnce(true);
      const result = await resolver.verifyPasswordOtp(
        '111111',
        '1111',
        context,
      );
      const newData = await trusteeModel.findById(trustee._id);
      expect(oldData.password_hash === newData.password_hash).toEqual(false);
      expect(result).toEqual('Password reset Successfully');
    });
    it('throw error if role is not owner', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner7',
        },
      };
      const oldData = await trusteeModel.findById(trustee._id);
      jest.spyOn(service, 'validatePasswordOtp').mockResolvedValueOnce(true);
      await expect(
        resolver.verifyPasswordOtp('111111', '1111', context),
      ).rejects.toThrow(
        new UnauthorizedException(
          'You are not Authorized to perform this action',
        ),
      );
    });
    it('throw error if trustee not found', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dummy@edviron.com',
        password_hash: 'dummy',
      }).save();
      const id = new Types.ObjectId(888);
      const context = {
        req: {
          trustee: id,
          role: 'owner',
        },
      };
      jest.spyOn(service, 'validatePasswordOtp').mockResolvedValueOnce(true);
      await expect(
        resolver.verifyPasswordOtp('111111', '1111', context),
      ).rejects.toThrow(new NotFoundException('Trustee Not Found'));
    });
    it.skip('throw error uin invalid otp', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dumm0988766y@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      jest.spyOn(service, 'validatePasswordOtp').mockResolvedValueOnce(false);
      await expect(
        resolver.verifyPasswordOtp('1111', '111', context),
      ).rejects.toThrow(new Error('Invalid OTP '));
    });
  });

  describe('sendOtp', () => {
    it('should send otp', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dumm0988766y@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      const type = 'reset';
      jest.spyOn(service, 'sentPasswordOtpMail').mockResolvedValueOnce(true);
      const result = await resolver.sendOtp(type, context);

      expect(result).toEqual(true);
    });
    it('should send otp', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dumm0988766y@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      const type = 'api';
      jest.spyOn(service, 'sentApiOtpMail').mockResolvedValueOnce(true);
      const result = await resolver.sendOtp(type, context);
      expect(result).toEqual(true);
    });
    it('should send otp', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dumm0988766y@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      const type = 'email';
      jest.spyOn(service, 'sentUpdateOtpMail').mockResolvedValueOnce(true);
      const result = await resolver.sendOtp(type, context);
      expect(result).toEqual(true);
    });
    it('should send otp', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dumm0988766y@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      const type = 'phone';
      jest.spyOn(service, 'sentUpdateNumberOtp').mockResolvedValueOnce(true);
      const result = await resolver.sendOtp(type, context);
      expect(result).toEqual(true);
    });
    it('should send otp', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dumm0988766y@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      const type = 'delete';
      jest.spyOn(service, 'sentDeleteOtp').mockResolvedValueOnce(true);
      const result = await resolver.sendOtp(type, context);
      expect(result).toEqual(true);
    });
    it('should send otp', async () => {
      const trustee = await new trusteeModel({
        name: 'dummy',
        email_id: 'dumm0988766y@edviron.com',
        password_hash: 'dummy',
      }).save();
      const context = {
        req: {
          trustee: trustee._id,
          role: 'owner',
        },
      };
      const type = 'reset2';
      jest.spyOn(service, 'sentPasswordOtpMail').mockResolvedValueOnce(false);
      const result = await resolver.sendOtp(type, context);
      expect(result).toEqual(false);
    });
  });
});

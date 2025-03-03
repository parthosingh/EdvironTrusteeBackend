import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, Model, Schema, Types, model } from 'mongoose';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import { getModelToken } from '@nestjs/mongoose';
import {
  FullKycStatus,
  MerchantStatus,
  MinKycStatus,
  SchoolSchema,
  TrusteeSchool,
} from '../schema/school.schema';
import { TrusteeService } from '../trustee/trustee.service';
import { ErpService } from '../erp/erp.service';
import { TrusteeResolver } from '../trustee/trustee.resolver';
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
import { TrusteeModule } from '../trustee/trustee.module';
import {
  TrusteeMember,
  TrusteeMemberSchema,
} from '../schema/partner.member.schema';
import { EmailService } from '../email/email.service';
import { MerchantModule } from '../merchant/merchant.module';
import { MerchantService } from '../merchant/merchant.service';
import { AwsS3Service } from '../aws.s3/aws.s3.service';
import { Commission, CommissionSchema } from '../schema/commission.schema';
import { MerchantMember } from '../schema/merchant.member.schema';
import { Invoice } from '../schema/invoice.schema';
import { RefundRequest } from '../schema/refund.schema';
import { VendorsSettlement } from '../schema/vendor.settlements.schema';
import { TempSettlementReport } from '../schema/tempSettlements.schema';
import { TransactionInfo } from '../schema/transaction.info.schema';
import { RequestMDR } from '../schema/mdr.request.schema';
import { BaseMdr } from '../schema/base.mdr.schema';
import { SchoolMdr } from '../schema/school_mdr.schema';
import { Vendors } from '../schema/vendors.schema';
import { Disputes } from '../schema/disputes.schema';
import { Reconciliation } from '../schema/Reconciliation.schema';
import { ErpController } from './erp.controller';
import { Earnings } from '../schema/earnings.schema';
import { Capture } from '../schema/capture.schema';
import { WebhookLogs } from '../schema/webhook.schema';

const mockErpService = {
  genrateLink: jest.fn(),
  getUser: jest.fn(),
  createSection: jest.fn(),
  createStudent: jest.fn(),
  createSchool: jest.fn(),
};

const MockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

describe('ErpController', () => {

  let controller: ErpController;
  let jwtService: JwtService;
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
  let CommissionModel: Model<Commission>;
  let MerchantMemberModel: Model<MerchantMember>;
  let InvoiceModel: Model<Invoice>;
  let RefundRequestModel: Model<RefundRequest>;
  let VendorsSettlementModel: Model<VendorsSettlement>;
  let TempSettlementReportModel: Model<TempSettlementReport>;
  let TransactionInfoModel: Model<TransactionInfo>;
  let RequestMDRModel: Model<RequestMDR>;
  let BaseMdrModel: Model<BaseMdr>;
  let SchoolMdrModel: Model<SchoolMdr>;
  let VendorsModel: Model<Vendors>;
  let DisputesModel: Model<Disputes>;
  let ReconciliationModel: Model<Reconciliation>;
  let EarningsModel: Model<Earnings>;
  let CapturetModel:Model<Capture>;
  let WebhookLogsModel:Model<WebhookLogs>;
  let emailService: EmailService;

  const mockRequest = {
    userTrustee: {
      id: '658e759736ba0754ca45d0c2',
    },
  };

  const mockStudent = {
    _id: '658e759736ba0754ca45d0a4',
    name: 'prashantNew20:48',
    phone_number: 9490293203,
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
    await mongoConnection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ErpController],
      providers: [
        TrusteeResolver,
        ErpService,
        MainBackendService,
        TrusteeService,
        EmailService,
        MerchantModule,
        MerchantService,
        AwsS3Service,
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
        {
          provide: getModelToken(Commission.name),
          useValue: CommissionModel,
        },
        {
          provide: getModelToken(MerchantMember.name),
          useValue: MerchantMemberModel,
        },
        {
          provide: getModelToken(Invoice.name),
          useValue: InvoiceModel,
        },
        {
          provide: getModelToken(RefundRequest.name),
          useValue: RefundRequestModel,
        },
        {
          provide: getModelToken(VendorsSettlement.name),
          useValue: VendorsSettlementModel,
        },
        {
          provide: getModelToken(TempSettlementReport.name),
          useValue: TempSettlementReportModel,
        },
        {
          provide: getModelToken(TransactionInfo.name),
          useValue: TransactionInfoModel,
        },
        {
          provide: getModelToken(RequestMDR.name),
          useValue: RequestMDRModel,
        },
        {
          provide: getModelToken(BaseMdr.name),
          useValue: BaseMdrModel,
        },
        {
          provide: getModelToken(SchoolMdr.name),
          useValue: SchoolMdrModel,
        },
        {
          provide: getModelToken(Vendors.name),
          useValue: VendorsModel,
        },
        {
          provide: getModelToken(Disputes.name),
          useValue: DisputesModel,
        },
        {
          provide: getModelToken(Reconciliation.name),
          useValue: ReconciliationModel,
        },
        {
          provide: getModelToken(Earnings.name),
          useValue: EarningsModel,
        },
        {
          provide: getModelToken(Capture.name),
          useValue: CapturetModel,
        },
        {
          provide: getModelToken(WebhookLogs.name),
          useValue: WebhookLogsModel,
        },
      ],
    }).compile();

    controller = module.get<ErpController>(ErpController);
    erpService = module.get<ErpService>(ErpService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // describe('genratePaymentLink', () => {
  //   it('should return payment link', async () => {
  //     const mockPhoneNumber = '7000061755';
  //     const mockPaymentLink = 'paymentlinkstring';

  //     jest.spyOn(service, 'genrateLink').mockResolvedValueOnce(mockPaymentLink);

  //     const result = await controller.genratePaymentLink(mockPhoneNumber);

  //     expect(service.genrateLink).toHaveBeenCalledWith(mockPhoneNumber);

  //     expect(result).toEqual(mockPaymentLink);
  //   });
  //   it('should throw BadRequestException', async () => {
  //     jest
  //       .spyOn(service, 'genrateLink')
  //       .mockRejectedValueOnce({ message: 'Bad Request' });

  //     await expect(
  //       controller.genratePaymentLink('7000061755'),
  //     ).rejects.toThrowError(BadRequestException);
  //   });
  // });
  // describe('validateApiKey', () => {
  //   it('should return api key', async () => {
  //     const name = 'raj';
  //     const email = 'somemail@edviron.com',
  //       phone_number = '70000000';
  //     const trustee_id = new Types.ObjectId('658e759736ba0754ca45d0c2');
  //     const mockTrustee = {
  //       name: 'test 001',
  //       email_id: 'one@gmail',
  //       password_hash:
  //         '$2b$10$.ykb8jlprPpauXQl6pK2jePMPVl6XI0qxjLF6chZHY8dF0T/zNW76',
  //       school_limit: 150,
  //       IndexOfApiKey: 0,
  //       phone_number: '444444444',
  //       _id: trustee_id,
  //       apiKey: 'opop',
  //       createdAt: '2024-01-05T12:10:10.300Z',
  //       updatedAt: '2024-01-05T12:10:10.300Z',
  //       __v: 0,
  //     };
  //     jest.spyOn(service, 'getUser').mockResolvedValue(mockTrustee);

  //     const result = await controller.validateApiKey(mockRequest);
  //     expect(service.getUser).toHaveBeenCalledWith(mockRequest.userTrustee.id);
  //     expect(result).toEqual(mockTrustee);
  //   });

  //   it('should throw NotFoundException for user not found', async () => {
  //     jest
  //       .spyOn(service, 'getUser')
  //       .mockRejectedValueOnce(new NotFoundException('User not found'));

  //     await expect(controller.validateApiKey(mockRequest)).rejects.toThrowError(
  //       NotFoundException,
  //     );
  //   });

  //   it('should throw UnauthorizedException for other errors', async () => {
  //     jest
  //       .spyOn(service, 'getUser')
  //       .mockRejectedValueOnce(new Error('Some error'));

  //     await expect(controller.validateApiKey(mockRequest)).rejects.toThrowError(
  //       UnauthorizedException,
  //     );
  //   });
  // });

  // describe('createSection', () => {
  //   it('should return created section', async () => {
  //     const school_id = '658958aad47898892d4d976c';
  //     const trustee_id = '658e759736ba0754ca45d0c2';
  //     const data = {
  //       className: '4',
  //       section: 'D05',
  //     };

  //     const body = {
  //       school_id,
  //       data,
  //     };

  //     const mockResponse = {
  //       section: {
  //         class: '4',
  //         section: 'D1',
  //         school_id: '658958aad47898892d4d976c',
  //         fine_per_day: 0,
  //         fine_grace_period: 7,
  //         fine_after_grace_period: 0,
  //         _id: '65857013b4f0da2269debfe1',
  //         createdAt: '2023-12-22T11:16:35.351Z',
  //         updatedAt: '2023-12-22T11:16:35.351Z',
  //         __v: 0,
  //       },
  //     };

  //     const mockJwtToken = { some: 'data' };

  //     jest.spyOn(service, 'createSection').mockResolvedValueOnce(mockResponse);

  //     const result = await controller.createSection(body, {
  //       userTrustee: { id: 'trustee_id' },
  //     });
  //     expect(service.createSection).toHaveBeenCalledWith(
  //       body.school_id,
  //       body.data,
  //       'trustee_id',
  //     );

  //     expect(result).toEqual(mockResponse);
  //   });
  //   it('should throw NotFoundException for 404 error', async () => {
  //     jest.spyOn(service, 'createSection').mockRejectedValueOnce({
  //       response: { statusCode: 404, message: 'Not Found' },
  //     });

  //     await expect(
  //       controller.createSection(
  //         { school_id: 'id', data: { className: 'class', section: 'sec' } },
  //         { userTrustee: { id: 'trustee_id' } },
  //       ),
  //     ).rejects.toThrowError(NotFoundException);
  //   });
  //   it('should throw ConflictException for 409 error', async () => {
  //     jest.spyOn(service, 'createSection').mockRejectedValueOnce({
  //       response: { statusCode: 409, message: 'Conflict' },
  //     });

  //     await expect(
  //       controller.createSection(
  //         { school_id: 'id', data: { className: 'class', section: 'sec' } },
  //         { userTrustee: { id: 'trustee_id' } },
  //       ),
  //     ).rejects.toThrowError(ConflictException);
  //   });

  //   it('should throw BadRequestException for other errors', async () => {
  //     jest
  //       .spyOn(service, 'createSection')
  //       .mockRejectedValueOnce({ message: 'Bad Request' });

  //     await expect(
  //       controller.createSection(
  //         { school_id: 'id', data: { className: 'class', section: 'sec' } },
  //         { userTrustee: { id: 'trustee_id' } },
  //       ),
  //     ).rejects.toThrowError(BadRequestException);
  //   });
  // });

  // describe('createSchool', () => {
  //   it('should return created school', async () => {
  //     const mockRequestBody = {
  //       name: 'John Doe',
  //       phone_number: '1234567890',
  //       email: 'john@example.com',
  //       school_name: 'Example School',
  //     };
  //     const mockCreatedSchoolData = { _id: '658e759736ba0754ca36d0c2' };
  //     jest
  //       .spyOn(service, 'createSchool')
  //       .mockResolvedValue(mockCreatedSchoolData);

  //     const result = await controller.createSchool(
  //       mockRequestBody,
  //       mockRequest,
  //     );

  //     expect(service.createSchool).toHaveBeenCalledWith(
  //       mockRequestBody.phone_number,
  //       mockRequestBody.name,
  //       mockRequestBody.email,
  //       mockRequestBody.school_name,
  //       mockRequest.userTrustee.id,
  //     );
  //     expect(result).toEqual(mockCreatedSchoolData);
  //   });
  //   it('should throw ConflictException for duplicate school creation', async () => {
  //     const mockRequestBody = {
  //       name: 'John Doe',
  //       phone_number: '1234567890',
  //       email: 'john@example.com',
  //       school_name: 'Example School',
  //     };

  //     jest.spyOn(service, 'createSchool').mockRejectedValueOnce({
  //       response: { statusCode: 409, message: 'Conflict' },
  //     });

  //     await expect(
  //       controller.createSchool(mockRequestBody, mockRequest),
  //     ).rejects.toThrowError(ConflictException);
  //   });

  //   it('should throw BadRequestException for other errors', async () => {
  //     const mockRequestBody = {
  //       name: 'John Doe',
  //       phone_number: '1234567890',
  //       email: 'john@example.com',
  //       school_name: 'Example School',
  //     };

  //     jest
  //       .spyOn(service, 'createSchool')
  //       .mockRejectedValueOnce({ message: 'Some error' });

  //     await expect(
  //       controller.createSchool(mockRequestBody, mockRequest),
  //     ).rejects.toThrowError(BadRequestException);
  //   });
  // });

  // describe('createStudent', () => {
  //   it('should create a student successfully', async () => {
  //     const mockBody = {
  //       name: 'prashantNew20:48',
  //       phone_number: 9490293203,
  //       class: '10th',
  //       section: 2,
  //       category: 'OBC',
  //       dob: '2023-12-31T23:59:59.999+00:00',
  //       gender: 'male',
  //       father_name: 'Hitesh Bansal',
  //       school_generated_id: '63ff2138742d8bdfbc91d4f7',
  //       school_id: '63ff2138742d8bdfbc91d4c6',
  //     };
  //     const mockCreatedStudentData = { _id: '658e759736ba0754ca36d0c2' };
  //     jest
  //       .spyOn(service, 'createStudent')
  //       .mockResolvedValue(mockCreatedStudentData);

  //     const result = await controller.createStudent(mockBody, mockRequest);

  //     expect(service.createStudent).toHaveBeenCalledWith(
  //       mockBody,
  //       mockBody.school_id,
  //       mockRequest.userTrustee.id,
  //     );
  //     expect(result).toEqual(mockCreatedStudentData);
  //   });
  //   it('should handle ConflictException', async () => {
  //     jest
  //       .spyOn(service, 'createStudent')
  //       .mockRejectedValue(new ConflictException('Conflict'));

  //     await expect(
  //       controller.createStudent(mockStudent, mockRequest),
  //     ).rejects.toThrow(ConflictException);
  //   });
  //   it('should handle NotFoundException', async () => {
  //     jest
  //       .spyOn(service, 'createStudent')
  //       .mockRejectedValue(new NotFoundException('Conflict'));

  //     await expect(
  //       controller.createStudent(mockStudent, mockRequest),
  //     ).rejects.toThrow(NotFoundException);
  //   });
  //   it('should handle other errors with BadRequestException', async () => {
  //     jest
  //       .spyOn(service, 'createStudent')
  //       .mockRejectedValue({ message: 'Bad Request' });

  //     await expect(
  //       controller.createStudent(mockStudent, mockRequest),
  //     ).rejects.toThrow(BadRequestException);
  //   });
  // });
});

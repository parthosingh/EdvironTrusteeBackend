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
import { MerchantResolver } from './merchant.resolver';
import { PdfService } from '../pdf-service/pdf-service.service';


describe('MerchantService', () => {
  let service: MerchantService;
  let resolver: MerchantResolver;
  let Trusteeresolver: TrusteeResolver;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let trusteeModel: Model<Trustee>;
  let trusteeSchoolModel: Model<TrusteeSchool>;
  let erpService: ErpService;
  let trusteeService: TrusteeService;
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


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrusteeResolver,
        ErpService,
        MainBackendService,
        TrusteeService,
        EmailService,
        MerchantModule,
        MerchantService,
        AwsS3Service,
        MerchantResolver,
        MerchantService,
        PdfService,
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
      ],
    }).compile();

    service = module.get<MerchantService>(MerchantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { PlatformChargesController } from './platform-charges.controller';
import { PlatformChargeService } from './platform-charges.service';
import { MainBackendService } from '../main-backend/main-backend.service';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import {
  FullKycStatus,
  MerchantStatus,
  MinKycStatus,
  SchoolSchema,
  TrusteeSchool,
  charge_type,
} from '../schema/school.schema';
import { Connection, Model, Types, Schema } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connect } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';

describe('PlatformChargesController', () => {
  let platformChargesController: PlatformChargesController;
  let platformChargeService: PlatformChargeService;
  let mainBackendService: MainBackendService;
  let trusteeModel: Model<Trustee>;
  let trusteeSchoolModel: Model<TrusteeSchool>;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;

  const mockTrusteeSchools = {
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
    merchantStatus: MerchantStatus.KYC_APPROVED,
    pgMinKYC: MinKycStatus.MIN_KYC_APPROVED,
    pgFullKYC: FullKycStatus.FULL_KYC_PENDING,
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

    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      controllers: [PlatformChargesController],
      providers: [
        PlatformChargeService,
        { provide: getModelToken(Trustee.name), useValue: trusteeModel },
        {
          provide: getModelToken(TrusteeSchool.name),
          useValue: trusteeSchoolModel,
        },
        {
          provide: MainBackendService,
          useValue: { createApiKey: jest.fn(), generateKey: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn() },
        },
      ],
    }).compile();

    platformChargesController = module.get<PlatformChargesController>(
      PlatformChargesController,
    );
    platformChargeService = module.get<PlatformChargeService>(
      PlatformChargeService,
    );
    mainBackendService = module.get<MainBackendService>(MainBackendService);
  });

  it('should be defined', () => {
    expect(platformChargesController).toBeDefined();
  });
});

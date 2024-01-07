import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, Model, Schema } from 'mongoose';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import { getModelToken } from '@nestjs/mongoose';
import { SchoolSchema, TrusteeSchool } from '../schema/school.schema';
import { TrusteeService } from './trustee.service';
import { ErpService } from '../erp/erp.service';
import { TrusteeResolver } from './trustee.resolver';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

describe('TrusteeResolver', () => {
  let resolver: TrusteeResolver;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let trusteeModel: Model<Trustee>;
  let trusteeSchoolModel: Model<TrusteeSchool>;
  let erpService: ErpService;
  let service: TrusteeService;

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
  const mockTrusteeSchools: TrusteeSchool[] = [
    {
      school_id: new Schema.Types.ObjectId('6099438e651824001f168b50', {
        suppressWarning: true,
      }),
      trustee_id: new Schema.Types.ObjectId('6099438e651824001f168b51', {
        suppressWarning: true,
      }),
      school_name: 'School A',
    },
    {
      school_id: new Schema.Types.ObjectId('6099438e651824001f168b53', {
        suppressWarning: true,
      }),
      trustee_id: new Schema.Types.ObjectId('6099438e651824001f168b54', {
        suppressWarning: true,
      }),
      school_name: 'School B',
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrusteeResolver,
        ErpService,
        { provide: getModelToken(Trustee.name), useValue: trusteeModel },
        {
          provide: getModelToken(TrusteeSchool.name),
          useValue: trusteeSchoolModel,
        },
        {
          provide: TrusteeService,
          useValue: {
            getSchools: jest.fn().mockResolvedValue(mockTrusteeSchools),
          },
        },
        {
          provide: ErpService,
          useValue: { createApiKey: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn() },
        },
      ],
    }).compile();
    service = module.get<TrusteeService>(TrusteeService);
    erpService = module.get<ErpService>(ErpService);
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
    it('should get a list of schools for given trustee', async () => {
      const trusteeId = mockTrustee._id;

      jest.spyOn(service, 'getSchools');

      const schools = await resolver.getSchoolQuery(5, 0, {
        req: { trustee: trusteeId },
      });

      expect(service.getSchools).toHaveBeenCalledWith(trusteeId, 5, 0);
      expect(schools).toEqual(mockTrusteeSchools);
    });
    it('should handle ConflictException', async () => {
      const mockContext = {
        req: { trustee: 'trustee_id' },
      };

      jest
        .spyOn(service, 'getSchools')
        .mockRejectedValue(new ConflictException('Conflict occurred'));

      try {
        await resolver.getSchoolQuery(5, 0, mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect(error.message).toBe('Conflict occurred');
      }
    });
    it('should handle other errors with BadRequestException', async () => {
      const mockContext = {
        req: { trustee: 'trustee_id' },
      };

      jest
        .spyOn(service, 'getSchools')
        .mockRejectedValue(new Error('Some generic error'));

      try {
        await resolver.getSchoolQuery(5, 0, mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Some generic error');
      }
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
});
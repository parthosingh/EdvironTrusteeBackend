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
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('TrusteeService', () => {
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let trusteeModel: Model<Trustee>;
  let trusteeSchoolModel: Model<TrusteeSchool>;
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

  const mockTrusteeSchool = [
    { school_id: 'school1', school_name: 'School 1' },
    { school_id: 'school2', school_name: 'School 2' },
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
        TrusteeService,
        {
          provide: JwtService,
          useValue: { sign: jest.fn() },
        },
      ],
    }).compile();
    service = module.get<TrusteeService>(TrusteeService);
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
      expect(trusteeSchoolModel.find).toHaveBeenCalledWith(
        { trustee_id: trusteeObjectId },
        { school_id: 1, school_name: 1, _id: 0 },
      );
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
  describe("generateSchoolToken",()=>{
    it('should return genrated token',async()=>{
      const schoolId = 'schoolId';
      const password = 'password';
      const trusteeId = 'trusteeId';

      // jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      jest.spyOn(trusteeModel, 'findById').mockResolvedValue(null);

    })
  })
});

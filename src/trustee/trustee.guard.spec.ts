import { TrusteeGuard } from './trustee.guard';
import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { TrusteeService } from './trustee.service';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import { Connection, Model, connect } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';

describe('TrusteeGuard', () => {
  let trusteeGuard: TrusteeGuard;
  let trusteeModel: Model<Trustee>;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let service: TrusteeService;

  const mockTrustee = {
    id: '658e759736ba0754ca45d0c2',
    name: 'John Doe',
    email: 'johndoe@example.com',
    apiKey: 'sampledApiKey',
    save: jest.fn().mockReturnThis(),
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    mongoConnection = (await connect(uri)).connection;
    trusteeModel = mongoConnection.model(Trustee.name, TrusteeSchema);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: getModelToken(Trustee.name), useValue: trusteeModel },
        {
          provide: TrusteeService,
          useValue: {
            validateTrustees: jest.fn().mockResolvedValue(mockTrustee),
          },
        }
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

  beforeEach(() => {
    trusteeGuard = new TrusteeGuard(service);
  });

  it('should be defined', () => {
    expect(trusteeGuard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when token is valid', async () => {
      // Arrange
      const validToken = 'validToken';
      const requestMock = {
        headers: { authorization: `Bearer ${validToken}` },
      };
      const contextMock: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => requestMock,
        }),
      } as ExecutionContext;

      // Mock the validateTrustee method
      Object.defineProperty(trusteeGuard, 'trusteeService', {
        value: { validateTrustee: jest.fn().mockResolvedValue(mockTrustee) },
        writable: true,
      });

      // Act
      const result = await trusteeGuard.canActivate(contextMock);

      // Assert
      expect(result).toBe(true);

    });

    it('should return false when token is not valid', async () => {
      // Arrange
      const invalidToken = 'invalidToken';
      const requestMock = {
        headers: { authorization: `Bearer ${invalidToken}` },
      };
      const contextMock: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => requestMock,
        }),
      } as ExecutionContext;

      // Mock the validateTrustee method
      Object.defineProperty(trusteeGuard, 'trusteeService', {
        value: { validateTrustee: jest.fn().mockRejectedValue(new Error('Invalid token')) },
        writable: true,
      });

      // Act
      const result = await trusteeGuard.canActivate(contextMock);

      // Assert
      expect(result).toBe(false);
    });
  });
});
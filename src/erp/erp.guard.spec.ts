import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ErpGuard } from './erp.guard';
import { ErpService } from './erp.service';
import { Connection, Model } from 'mongoose';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connect } from 'mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

describe('ErpGuard', () => {
  let erpGuard: ErpGuard;
  let erpService: ErpService;
  let trusteeModel: Model<Trustee>;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;

  const mockTrustee = {
    id: '658e759736ba0754ca45d0c2',
    name: 'John Doe',
    email: 'johndoe@example.com',
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
          provide: ErpService,
          useValue: {
            validateApiKey: jest.fn().mockResolvedValue(mockTrustee),
          },
        }
      ],
    }).compile();
    erpService = module.get<ErpService>(ErpService);
  });
  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
  });

  beforeEach(() => {
    erpGuard = new ErpGuard(erpService);
  });

  it('should be defined', () => {
    expect(erpGuard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true and set userTrustee when Bearer token is valid', async () => {
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

      // Mock the validateApiKey method
      jest.spyOn(erpService, 'validateApiKey').mockResolvedValue({ id: '123', name: 'John Doe' });

      // Act
      const result = await erpGuard.canActivate(contextMock);

      // Assert
      expect(result).toBe(true);
      // expect(requestMock.userTrustee).toEqual({ id: '123', name: 'John Doe' });
    });

    it('should throw UnauthorizedException when Bearer token is missing', async () => {
      // Arrange
      const requestMock = {
        headers: {},
      };
      const contextMock: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => requestMock,
        }),
      } as ExecutionContext;

      // Act & Assert
      await expect(erpGuard.canActivate(contextMock)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when Bearer token is invalid', async () => {
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

      // Mock the validateApiKey method to throw an error
      jest.spyOn(erpService, 'validateApiKey').mockRejectedValue(new Error('Invalid Bearer token'));

      // Act & Assert
      await expect(erpGuard.canActivate(contextMock)).rejects.toThrow(UnauthorizedException);
    });
  });
});

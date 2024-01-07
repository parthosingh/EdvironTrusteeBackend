import { Test, TestingModule } from '@nestjs/testing';
import { MainBackendController } from './main-backend.controller';
import { MainBackendService } from './main-backend.service';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Trustee } from '../schema/trustee.schema';
import { TrusteeSchool } from '../schema/school.schema';
import { JwtPayload } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { BadRequestException, ConflictException } from '@nestjs/common';

const mockMainbackenService = {
  createTrustee: jest.fn(),
  findTrustee: jest.fn(),
  findOneTrustee: jest.fn(),
  assignSchool: jest.fn(),
}

const MockJwtService = {
  sign: jest.fn(),
  verify: jest.fn()
};

describe('MainBackendController', () => {
  let controller: MainBackendController;
  let service: MainBackendService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MainBackendController],
      providers: [
        MainBackendService,
        {
          provide: getModelToken(Trustee.name),
          useValue: {},
        },
        {
          provide: getModelToken(TrusteeSchool.name),
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: MockJwtService,
        },
        {
          provide: MainBackendService,
          useValue: mockMainbackenService,
        },
      ],
    }).compile();

    controller = module.get<MainBackendController>(MainBackendController);
    service = module.get<MainBackendService>(MainBackendService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTrustee', () => {
    it('should return a signed JWT token', async () => {
      const mockData = { data: 'mockData' };
      const mockJwtPayload: JwtPayload = { credential: 'mockCredential' };

      const mockTrustee = {
        // Mocked trustee data
        _id: new Types.ObjectId(),
        name: 'John Doe',
        email_id: 'john@example.com',
        password_hash: 'hashedPassword',
        school_limit: 10,
        phone_number: '1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0,
      };

      const mockToken = 'mockToken';

      // Mock the dependencies
      MockJwtService.verify.mockReturnValue(mockJwtPayload);
      mockMainbackenService.createTrustee.mockResolvedValue(mockTrustee);
      MockJwtService.sign.mockReturnValue(mockToken);

      // Act
      const result = await controller.createTrustee(mockData);

      // Assert
      expect(MockJwtService.verify).toHaveBeenCalledWith(mockData.data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      expect(mockMainbackenService.createTrustee).toHaveBeenCalledWith(mockJwtPayload);
      expect(MockJwtService.sign).toHaveBeenCalledWith({ credential: mockTrustee });
      expect(result).toEqual(mockToken);


    });

    it('should throw BadRequestException for other errors', async () => {
      // Mocking the behavior of jwtService.verify that throws an exception
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw { message: 'Bad Request' };
      });

      // Execute the method and assert
      await expect(controller.createTrustee({ data: 'mockData' })).rejects.toThrowError(BadRequestException);
    });

  })


  // describe('findTrustee', () => {
  //   it('should return arrays of trustee', async () => {
  //     const mockPage = 1;
  //     const mockPageSize = 10;

  //     const mockTrusteeData = [
  //       {
  //         _id: new Types.ObjectId(),
  //         name: 'John Doe',
  //         email_id: 'john@example.com',
  //         password_hash: 'hashedPassword',
  //         school_limit: 10,
  //         phone_number: '1234567890',
  //         createdAt: new Date(),
  //         updatedAt: new Date(),
  //         __v: 0,
  //       },
  //     ];

  //     const mockToken = 'mockToken';
  //     mockMainbackenService.findTrustee.mockResolvedValue(mockTrusteeData);
  //     MockJwtService.sign.mockReturnValue(mockToken);

  //     const result = await controller.findTrustee(mockPage, mockPageSize);

  //     expect(mockMainbackenService.findTrustee).toHaveBeenCalledWith(mockPage, mockPageSize);
  //     expect(MockJwtService.sign).toHaveBeenCalledWith(mockTrusteeData, {
  //       secret: process.env.JWT_SECRET_FOR_INTRANET,
  //     });
  //     expect(result).toEqual(mockToken);

  //   })
  // })

  // describe('assignSchool', () => {
  //   it('should return assihned school token', async () => {
  //     const mockToken = 'mockToken';
  //     const school_id = "658958aad47898893d4d976c"
  //     const trustee_id = "658e759736ba0754ca45d0c2"
  //     const mockJwtPayload: JwtPayload = {
  //       school_id: school_id,
  //       trustee_id: trustee_id,
  //       school_name: 'some school'
  //     };

  //     MockJwtService.verify.mockReturnValue(mockJwtPayload);
  //     mockMainbackenService.findOneTrustee.mockResolvedValue({
  //       // Mocked trustee data
  //       _id: new Types.ObjectId(trustee_id),
  //       name: 'John Doe',
  //       email_id: 'john@example.com',
  //       password_hash: 'hashedPassword',
  //       school_limit: 10,
  //       phone_number: '1234567890',
  //       createdAt: new Date(),
  //       updatedAt: new Date(),
  //       __v: 0,
  //     });

  //     mockMainbackenService.assignSchool.mockResolvedValue({
  //       // Mocked assigned school data
  //       school_id: new Types.ObjectId(school_id),
  //       trustee_id: new Types.ObjectId(trustee_id),
  //       school_name: 'some school',
  //       _id: new Types.ObjectId(),
  //     });

  //     MockJwtService.sign.mockReturnValue(mockToken);

  //     const result = await controller.assignSchool({ token: 'mock' });

  //   // Assert
  //   expect(MockJwtService.verify).toHaveBeenCalledWith('mock', {
  //     secret: process.env.JWT_SECRET_FOR_INTRANET,
  //   });
    
      
  //   expect(mockMainbackenService.findOneTrustee).toHaveBeenCalledWith(
  //     new Types.ObjectId(trustee_id)
  //   );

  //   expect(mockMainbackenService.assignSchool).toHaveBeenCalledWith(
  //     // new Types.ObjectId(school_id),
  //     // new Types.ObjectId(trustee_id),
  //     school_id,
  //     trustee_id,
  //     'some school'
  //   );

  //   const payload = {
  //     school_id: new Types.ObjectId(school_id),
  //     trustee_id: new Types.ObjectId(trustee_id),
  //     school_name: 'some school',
  //     _id: expect.any(Types.ObjectId),
  //   };
    
  //   expect(MockJwtService.sign).toHaveBeenCalledWith(payload, {
  //     secret: process.env.JWT_SECRET_FOR_INTRANET,
  //   });
    
  //   expect(result).toEqual(mockToken);



  //   })
  // })

});
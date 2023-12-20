import { Test, TestingModule } from '@nestjs/testing';
import { TrusteeService } from './trustee.service';
import { getModelToken } from '@nestjs/mongoose';
import { Trustee } from '../schema/trustee.schema'; 
import { mock } from 'node:test';
import { Connection, Model } from 'mongoose';
import { Mode } from 'node:fs';
import { NotFoundError } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import axios from 'axios'
import { BadGatewayException, BadRequestException } from '@nestjs/common';

describe('TrusteeService', () => {
   
  
  const MockTrusteeModel = {
    genrateLink: jest.fn(),
    
  };
  let model:Model<Trustee>
  let service: TrusteeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrusteeService,
        {provide:Connection, useValue:{}},
        {
        provide: getModelToken(Trustee.name),
        useValue:MockTrusteeModel
      },
      
    ],
    }).compile();

    service = module.get<TrusteeService>(TrusteeService);
    
  });

  

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('genrateLink',()=>{
    it('should return paymentlink',async()=>{
      
      const expectedTrustee="paymentlink"
      const phone_number = '1111111'
      const mockToken = 'mockToken';
      const mockResponse = { data: expectedTrustee };
      jest.spyOn(jwt, 'sign').mockImplementationOnce((payload, secret) => Promise.resolve(mockToken));

      jest.spyOn(axios, 'get').mockResolvedValueOnce(mockResponse);

      const trustee = await service.genrateLink(phone_number);
      expect(jwt.sign).toHaveBeenCalledWith( phone_number , process.env.PRIVATE_TRUSTEE_KEY);
      expect(axios.get).toHaveBeenCalledWith(`${process.env.MAIN_BACKEN_URL}/api/trustee/payment-link?token=${mockToken}`);
      expect(trustee).toEqual(expectedTrustee);
    })

    it('should throw BadGatewayException with error message', async () => {
      const phone_number = '1111111';
      const mockToken = 'mockToken';
      const mockAxiosError = new Error('Axios error');

      jest.spyOn(jwt, 'sign').mockImplementationOnce((payload, secret) => Promise.resolve(mockToken));

      jest.spyOn(axios, 'get').mockRejectedValueOnce(mockAxiosError);

      await expect(service.genrateLink(phone_number)).rejects.toThrowError(
        new BadGatewayException(mockAxiosError.message)
      );

      await expect(jwt.sign).toHaveBeenCalledWith(phone_number, process.env.PRIVATE_TRUSTEE_KEY);
      await expect(axios.get).toHaveBeenCalledWith(`${process.env.MAIN_BACKEN_URL}/api/trustee/payment-link?token=${mockToken}`);
    });
  })

 
});
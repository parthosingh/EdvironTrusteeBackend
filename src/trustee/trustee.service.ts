import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
  } from '@nestjs/common';
  import { InjectModel } from '@nestjs/mongoose';
  import mongoose, { Types } from 'mongoose';
  import { Trustee } from './schema/trustee.schema';
  import { JwtService } from '@nestjs/jwt';
  
  @Injectable()
  export class TrusteeService {
    constructor(
      @InjectModel(Trustee.name)
      private trusteeModel: mongoose.Model<Trustee>,
      private readonly jwtService: JwtService,
    ) {}


    async validateApiKey(apiKey: string): Promise<any> {
        try {
          const decodedPayload = this.jwtService.verify(apiKey, {
            secret: process.env.JWT_FOR_TRUSTEE_AUTH,
          });

          const trustee = await this.trusteeModel.findById(decodedPayload.trusteeId);

          if(!trustee)
            throw new NotFoundException('trustee not found')
    
          if(trustee.IndexOfApiKey !== decodedPayload.IndexOfApiKey)
            throw new Error('API key expired')
          
        const userTrustee = {id: trustee._id, name: trustee.name, email: trustee.email_id}

          return userTrustee;
        } catch (error) {
            // console.log(error);
            
          throw new UnauthorizedException("Invalid API key");
        }
      }
  }
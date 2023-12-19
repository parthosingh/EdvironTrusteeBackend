import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { ConflictException, Injectable,BadGatewayException, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Trustee } from './schema/trustee.schema';
import * as  mongoose from 'mongoose';
import * as jwt from 'jsonwebtoken';
import axios from 'axios'
import * as bcrypt from 'bcrypt';


@Injectable()
export class TrusteeService {
  constructor(
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    private jwtService: JwtService,
  ) {}

  async findTrustee(): Promise<Trustee[]> {
    const trustee = await this.trusteeModel.find();
    return trustee;
  }

  async createTrustee(info): Promise<Trustee> {
    const { name, email, password, school_limit } = info;
    try {
      const checkMail = await this.trusteeModel
        .findOne({ email_id: email })
        .exec();

      if (checkMail) {
        throw new ConflictException(`${email} already exist`);
      }

      const trustee = await new this.trusteeModel({
        name: name,
        email_id: email,
        password_hash: password,
        school_limit: school_limit,
      }).save();
      return trustee;
    } catch (error) {
      if (error.response.statusCode === 409) {
        throw new ConflictException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }
  async createApiKey(trusteeId: string): Promise<string> {
    try {
      if (!Types.ObjectId.isValid(trusteeId)) {
        throw new BadRequestException('Invalid trusteeId input');
      }
      const trustee = await this.trusteeModel.findById(trusteeId, {
        password_hash: 0,
      });

      if (!trustee) {
        throw new NotFoundException('Trustee not found');
      }

      trustee.IndexOfApiKey++;
      const updatedTrustee = await trustee.save();
      const payload = {
        trusteeId: updatedTrustee._id,
        IndexOfApiKey: updatedTrustee.IndexOfApiKey,
      };
      const apiKey = this.jwtService.sign(payload, {
        secret: process.env.JWT_FOR_TRUSTEE_AUTH,
      });

      return apiKey;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }




    async genrateLink(phone_number:string){
         
        try{

            const token = jwt.sign(phone_number,process.env.PRIVATE_TRUSTEE_KEY )
            const response = await axios.get(`${process.env.MAIN_BACKEN_URL}/api/trustee/payment-link?token=${token}`)
            return response.data
        }catch(error){
            console.log(error);
            
            throw new BadGatewayException(error.message)
        }
    }
  
    async loginAndGenerateToken(
      emailId: string,
      passwordHash: string,
    ): Promise<{ token: string }> {
      try {
        const trustee = await this.trusteeModel.findOne({ email_id: emailId });
  
        if (!trustee) {
          throw new UnauthorizedException('Invalid credentials');
        }
  
        const passwordMatch = await bcrypt.compare(
          passwordHash,
          trustee.password_hash,
        );
  
        if (!passwordMatch) {
          throw new UnauthorizedException('Invalid credentials');
        }
  
        const payload = {
          id: trustee._id,
        };
  
        return {
          token: await this.createApiKey(trustee._id),
        }; // Return the JWT token
      } catch (error) {
        console.error('Error in login process:', error);
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    async createApiKey(trusteeId: string): Promise<string> {
      try {
        const trustee = await this.trusteeModel.findById(trusteeId, {
          password_hash: 0,
        });
  
        if (!trustee) {
          throw new NotFoundException('Trustee not found');
        }
  
  
        trustee.IndexOfApiKey++;
        const updatedTrustee = await trustee.save();
        const payload = {
          updatedTrustee,
        };
        const apiKey = this.jwtService.sign(payload, {
          secret: process.env.API_JWT_SECRET,
        });
  
        return apiKey;
      } catch (error) {
        throw new Error(error.message);
      }
    }
}


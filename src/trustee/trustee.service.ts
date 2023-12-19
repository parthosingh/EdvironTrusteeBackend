import { JwtService } from '@nestjs/jwt';
import mongoose, { Types, ObjectId } from 'mongoose';
import { ConflictException, Injectable,BadGatewayException, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Trustee } from './schema/trustee.schema';
import { TrusteeSchool } from './schema/school.schema';
import * as jwt from 'jsonwebtoken';
import axios from 'axios'
import * as bcrypt from 'bcrypt';
import {JwtPayload} from 'jsonwebtoken'


@Injectable()
export class TrusteeService {
  constructor(
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
      @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
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
          throw new UnauthorizedException("Invalid API key");
        }
      }
      
       async getSchools(trusteeId: string, limit: number, offset: number) {
    try {
      if (!Types.ObjectId.isValid(trusteeId)) {
        throw new BadRequestException('Invalid trusteeID format');
      }
      const trustee = await this.trusteeModel.findById(trusteeId);

      if (!trustee) {
        throw new ConflictException(`no trustee found`);
      }
      const schools = await this.trusteeSchoolModel
        .find(
          { trustee_id: trusteeId },
          { school_id: 1, school_name: 1, _id: 0 },
        )
        .skip(offset)
        .limit(limit)
        .exec();
      return schools;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }
  
  
  async createSection(school_id,data:object){

        try{
            
            if (!Types.ObjectId.isValid(school_id)) {
                throw new BadRequestException('Invalid school_id format');
            }
            
            const info = {
                school_id:school_id,
                data:data 
            }
            const token = jwt.sign(info,process.env.PRIVATE_TRUSTEE_KEY,{expiresIn:'1h'})
            
            const section = await axios.post(`${process.env.MAIN_SERVER_URL}/api/trustee/section`,{
                token:token
            }) 
            return section.data
        }catch(error){
            if(error.response.data.statusCode === 409){
                throw new ConflictException(error.response.data.message)
            }
            throw new BadRequestException(error.message);
        }
    }


}

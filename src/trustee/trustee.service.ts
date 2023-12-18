import { ConflictException, Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Trustee } from './schema/trustee.schema';
import * as  mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';



@Injectable()
export class TrusteeService {
    constructor(
        @InjectModel(Trustee.name)
        private trusteeModel: mongoose.Model<Trustee>,
        private readonly jwtService: JwtService
    ) { }


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
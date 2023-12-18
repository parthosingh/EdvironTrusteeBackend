import { ConflictException, Injectable, UnauthorizedException, NotFoundException, BadRequestException, Body } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Trustee } from './schema/trustee.schema';
import * as  mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { TrusteeSchool } from './schema/school.schema';



@Injectable()
export class TrusteeService {
    constructor(
        @InjectModel(Trustee.name)
        private trusteeModel: mongoose.Model<Trustee>,
        @InjectModel(TrusteeSchool.name)
        private trusteeSchoolModel:mongoose.Model<TrusteeSchool>,
        private readonly jwtService: JwtService
    ) { }

    async generateSchoolToken(schoolId: string,password:string, trusteeId: string){
      try {
        // Parallel execution of database queries using Promise.all()
        const [school, trustee] = await Promise.all([
          this.trusteeSchoolModel.findOne({ school_id: schoolId }),
          this.trusteeModel.findById(trusteeId),
        ]);
    
        // Specific error handling using custom error classes
        if (!trustee) {
          throw new NotFoundException('Trustee not found');
        }
    
        if (!school) {
          throw new NotFoundException('School not found!');
        }
    
        // Password validation and JWT token generation
        const passwordMatch = await bcrypt.compare(password, trustee.password_hash);
        if (!passwordMatch) {
          throw new UnauthorizedException();
        }
    
        const data = { schoolId: school.school_id, admin_id: school.super_admin_id };
        const token = this.jwtService.sign(data, { secret: process.env.PRIVATE_TRUSTEE_KEY });
    
        // Making a POST request to an external endpoint
        const schoolToken = await axios.post(`${process.env.MAIN_SERVER_URL}/gen-school-token`, {
          token: token,
        });

        return schoolToken.data;
      } catch (error) {
        // Structured error handling for different scenarios
        if (error.response) {
          throw error;
        } else if (error.request) {
          throw new BadRequestException('No response received from the server');
        } else {
          throw new BadRequestException('Request setup error');
        }
      }
  }
    

}
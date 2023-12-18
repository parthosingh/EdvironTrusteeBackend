import { ConflictException, Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
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

      async createSchool(phone_number: string, name: string, email: string, school_name: string, trustee: string){

        try{   
            const data = {
              phone_number, name, email, school_name
            }
            const token = this.jwtService.sign(data,{secret:process.env.PRIVATE_TRUSTEE_KEY});
            
            const school = await axios.post(`${process.env.MAIN_SERVER_URL}/create-school`,{
                token:token
            })

            const trusteeSchool = await this.trusteeSchoolModel.create({school_id: school.data.adminInfo.school_id, school_name:school.data.updatedSchool.updates.name, trustee_id: trustee})
            
            return school.data
        }catch (error) {
          
          if (error.response) {
            // The request was made and the server responded with a non-success status code
            if (error.response.status === 409) {
              throw new ConflictException(error.response.data.message);
            } else if (error.response.data.message == 'Invalid phone number!'){
              throw new BadRequestException('Invalid phone number!')
            } else if (error.response.data.message == 'Invalid email!'){
              throw new BadRequestException('Invalid email!')
            } else if(error.response.data.message ==='User already exists'){
              throw new BadRequestException('User already exists');
            } else {
              // Handle other server response errors
              throw new BadRequestException('Failed to create school');
            }
          } else if (error.request) {
            // The request was made but no response was received
            throw new BadRequestException('No response received from the server');
          } else {
            // Something happened in setting up the request that triggered an Error
            console.log(error);
            
            throw new BadRequestException('Request setup error');
          }
        }
    }
    

}
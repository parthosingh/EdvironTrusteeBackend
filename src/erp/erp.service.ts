import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import mongoose, { ObjectId, Types } from 'mongoose';
import { TrusteeSchool } from 'src/schema/school.schema';
import { Trustee } from 'src/schema/trustee.schema';

@Injectable()
export class ErpService {
  constructor(
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    private jwtService: JwtService,
  ) {}

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
        secret: process.env.JWT_SECRET_FOR_API_KEY,
        expiresIn: '30d',
      });

      return apiKey;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  async genrateLink(phone_number: string) {
    try {
      const token = this.jwtService.sign(
        { phone_number },
        { secret: process.env.JWT_SECRET_FOR_INTRANET, expiresIn: '2h' },
      );
      const response = await axios.get(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/payment-link?token=${token}`,
      );
      const link = this.jwtService.verify(response.data,{
        secret: process.env.JWT_SECRET_FOR_INTRANET
      })
      return link;
    } catch (error) {
      throw new BadGatewayException(error.message);
    }
  }

  async validateApiKey(apiKey: string): Promise<any> {
    try {
      const decodedPayload = this.jwtService.verify(apiKey, {
        secret: process.env.JWT_SECRET_FOR_API_KEY,
      });

      const trustee = await this.trusteeModel.findById(
        decodedPayload.trusteeId,
      );

      if (!trustee) throw new NotFoundException('trustee not found');

      if (trustee.IndexOfApiKey !== decodedPayload.IndexOfApiKey)
        throw new Error('API key expired');

      const userTrustee = {
        id: trustee._id,
        name: trustee.name,
        email: trustee.email_id,
      };

      return userTrustee;
    } catch (error) {
      if(error instanceof NotFoundException)
        throw error
      throw new UnauthorizedException('Invalid API key');
    }
  }

  async createSection(school_id, data: object,trustee_id:ObjectId) {
    try {
      if (!Types.ObjectId.isValid(school_id)) {
        throw new BadRequestException('Invalid school_id format');
      }
      const schoolId = new Types.ObjectId(school_id)

      const checkSchool = await this.trusteeSchoolModel.findOne({
        trustee_id,
        school_id:schoolId
      })
      if(!checkSchool){
        throw new NotFoundException('school not found for given trustee')
      }

      const info = {
        school_id: schoolId,
        data: data,
      };
      const token = this.jwtService.sign(info, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
        expiresIn: '2h',
      });

      const sectionToken = await axios.post(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/section`,
        {
          token: token,
        },
      );
      const section = this.jwtService.verify(sectionToken.data,{
        secret:process.env.JWT_SECRET_FOR_INTRANET
      })
      return section
    } catch (error) {
      if (error.response.data && error.response.data.statusCode === 409) {
        throw new ConflictException(error.response.data.message);
      }else if(error.response && error.response.statusCode === 404){
        throw new NotFoundException(error.message)
      }else{
        throw new BadRequestException(error.message);
      }
    }
  }

  async createSchool(
    phone_number: string,
    name: string,
    email: string,
    school_name: string,
    trustee: ObjectId,
  ): Promise<any> {
    try {
      
      const data = {
        phone_number,
        name,
        email,
        school_name,
      };
      const token = this.jwtService.sign(data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
        expiresIn: '2h',
      });

      const schoolToken = await axios.post(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/create-school`,
        {
          token: token,
        },
      );
      
      const school=this.jwtService.verify(schoolToken.data,{
        secret:process.env.JWT_SECRET_FOR_INTRANET
      }) 
       
      const schoolId = new Types.ObjectId(school.adminInfo.school_id)
      
      const trusteeSchool = await this.trusteeSchoolModel.create({
        school_id: schoolId,
        school_name: school.updatedSchool.updates.name,
        trustee_id: trustee,
      });
      
      
      return school;
    } catch (error) {
     
      if (error.response) {
        // The request was made and the server responded with a non-success status code
        if (error.response.status === 409) {
          throw new ConflictException(error.response.data.message);
        } else if (error.response.data.message == 'Invalid phone number!') {
          throw new BadRequestException('Invalid phone number!');
        } else if (error.response.data.message == 'Invalid email!') {
          throw new BadRequestException('Invalid email!');
        } else if (error.response.data.message === 'User already exists') {
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
        throw new BadRequestException('Request setup error');
      }
    }
  }

  async createStudent(Student, schoolId,trustee_id) {
    try {
      const Key = process.env.JWT_SECRET_FOR_INTRANET;

      const school_Id = new Types.ObjectId(schoolId)
      const checkSchool = await this.trusteeSchoolModel.findOne({
        trustee_id,
        school_id:school_Id
      })
      if(!checkSchool){
        
        throw new NotFoundException('school not found for given trustee')
      }

      const info = {
        schoolId: schoolId,
        ...Student,
      };
      const token = this.jwtService.sign(info, {
        secret: Key,
        expiresIn: '2h',
      });
      const studentToken = await axios.post(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/createStudent`,
        {
          token: token,
        },
      );

      const student = this.jwtService.verify(studentToken.data,{
        secret: Key
      })
      
      return student;
    } catch (error) {
      
      if (error.response.data && error.response.data.statusCode === 400) {
        throw new BadRequestException(error.response.data);
      }else if (error.response.data && error.response.data.statusCode === 409) {
        throw new ConflictException(error.response.data);
      }else if(error.response && error.response.statusCode === 404){
        throw new NotFoundException(error.message)
      }else if(error instanceof NotFoundException){
        throw error
      } else {
        
        throw new BadRequestException(error.message);
      }
    }
  }

  async getUser(trusteeId: ObjectId) {
    try {
      const trustee = await this.trusteeModel.findById(trusteeId);
      if (!trustee)
        throw new NotFoundException('Trustee doesn not exist');
      const userInfo = { name: trustee.name, email_id: trustee.email_id, phone_number: trustee.phone_number }
      return userInfo;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ConflictException('Error in finding trustee')
    }
  }
}
 
import { JwtService } from '@nestjs/jwt';
import mongoose, { Types, ObjectId } from 'mongoose';
import { ConflictException, Injectable,BadGatewayException, UnauthorizedException, NotFoundException, BadRequestException, ForbiddenException, Body } from '@nestjs/common';
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
            
            const section = await axios.post(`${process.env.MAIN_BACKEN_URL}/api/trustee/section`,{
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


 async findTrustee(page,pageSize) {
        try{

            const totalItems = await this.trusteeModel.countDocuments();
            const totalPages = Math.ceil(totalItems / pageSize);

            const trustee = await this.trusteeModel.find()
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .exec();

            const pagination={
                data: trustee,
                page,
                pageSize,
                totalPages,
                totalItems,
              };
            return pagination
        }catch(err){
            throw new NotFoundException(err.message)
        }
    }

    async findOneTrustee(trustee_id:Types.ObjectId){
        try{
            const trustee = await this.trusteeModel.findOne(trustee_id)
            return trustee
        }catch(error){
            
            
            throw new BadRequestException(error.message)
        }
    }

   
  
    async checkSchoolLimit(trustee_id){
        const countDocs = await this.trusteeSchoolModel.countDocuments({trustee_id})
        console.log(countDocs);
        return countDocs
    }

    async assignSchool(school_id:Types.ObjectId,trustee_id:Types.ObjectId,school_name:string){
        
        try{


            const trustee = await this.trusteeModel.findOne(new Types.ObjectId(trustee_id))
            const countSchool = await this.checkSchoolLimit(trustee_id)
            const check = await this.trusteeSchoolModel.find({
                trustee_id,
                school_id
            })

            if(check.length>0){
                throw new ForbiddenException('alrady assigned')
            }
            if(countSchool === trustee.school_limit){
                throw new ForbiddenException('You cannot add more school')
            }
            const school=await new this.trusteeSchoolModel({
                school_id,
                trustee_id,
                school_name 
            }).save()
            return school
        }catch(error){
            if(error.response.statusCode === 403){
                throw new ForbiddenException(error.message)
            }
            
            throw new BadGatewayException(error.message)
        }
    }


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
    
        const data = { schoolId: school.school_id};
        const token = this.jwtService.sign(data, { secret: process.env.PRIVATE_TRUSTEE_KEY });
    
        // Making a POST request to an external endpoint
        const schoolToken = await axios.post(`${process.env.MAIN_SERVER_URL}/api/trustee/gen-school-token`, {
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


  async createSchool(phone_number: string, name: string, email: string, school_name: string, trustee: string){

        try{   
            const data = {
              phone_number, name, email, school_name
            }
            const token = this.jwtService.sign(data,{secret:process.env.PRIVATE_TRUSTEE_KEY});
            
            const school = await axios.post(`${process.env.MAIN_SERVER_URL}/api/trustee/create-school`,{
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

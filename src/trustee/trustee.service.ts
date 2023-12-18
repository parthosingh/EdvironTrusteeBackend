import { ConflictException, Injectable, UnauthorizedException, NotFoundException, BadGatewayException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ObjectId, Types } from "mongoose";
import { Trustee } from './schema/trustee.schema';
import * as  mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import axios from 'axios'
import { TrusteeSchool } from './schema/school.schema';



@Injectable()
export class TrusteeService {
    constructor(
        @InjectModel(Trustee.name)
        private trusteeModel: mongoose.Model<Trustee>,
        @InjectModel(TrusteeSchool.name)
        private trusteeSchoolModel:mongoose.Model<TrusteeSchool>
    ) { }

    

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


}
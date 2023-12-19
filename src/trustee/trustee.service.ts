import { ConflictException, Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Trustee } from './schema/trustee.schema';
import * as  mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { Types, ObjectId } from 'mongoose';
const url = process.env.MAIN_SERVER_URL
import {JwtPayload} from 'jsonwebtoken'

@Injectable()
export class TrusteeService {
    constructor(
        @InjectModel(Trustee.name)
        private trusteeModel: mongoose.Model<Trustee>
    ) { }


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
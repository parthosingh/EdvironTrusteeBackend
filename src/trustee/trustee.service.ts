import { ConflictException, Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Trustee } from './schema/trustee.schema';
import * as  mongoose from 'mongoose';



@Injectable()
export class TrusteeService {
    constructor(
        @InjectModel(Trustee.name)
        private trusteeModel: mongoose.Model<Trustee>
    ) { }


    async findTrustee(): Promise<Trustee[]> {
        const trustee = await this.trusteeModel.find()
        return trustee
    }

    
    async createTrustee(info):Promise<Trustee> {

        

        const { name, email, password, school_limit } = info
        try {
            const checkMail = await this.trusteeModel.findOne({ email_id: email }).exec()

            if (checkMail) {
                
                throw new ConflictException(`${email} already exist`)
            }

            const trustee = await new this.trusteeModel({
                name: name,
                email_id: email,
                password_hash: password,
                school_limit: school_limit,
            }).save();
            return trustee

        } catch (error) {
            
            if(error.response.statusCode === 409){
                 
                throw new ConflictException(error.message)
            }
            throw new BadRequestException(error.message)
        }
    }



}
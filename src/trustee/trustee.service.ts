import { ConflictException, Injectable, UnauthorizedException, NotFoundException, BadGatewayException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Trustee } from './schemas/trustee.schema';
import * as  mongoose from 'mongoose';
import * as jwt from 'jsonwebtoken';
import axios from 'axios'



@Injectable()
export class TrusteeService {
    constructor(
        @InjectModel(Trustee.name)
        private trusteeModel: mongoose.Model<Trustee>
    ) { }

    async genrateLink(phone_number:string){
         
        try{

            const token = jwt.sign(phone_number,process.env.PRIVATE_TRUSTEE_KEY )
            const response = await axios.get(`${process.env.MAIN_BACKEN_URL}/api/trustee/payment-link?token=${token}`)
            return response.data
        }catch(error){
            throw new BadGatewayException(error.message)
        }
    }
}

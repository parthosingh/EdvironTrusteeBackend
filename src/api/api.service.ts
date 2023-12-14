import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
// import { Trustee } from 'src/database/schema/trustee';

@Injectable()
export class ApiService {
    // constructor(
    //     @InjectModel(Trustee.name)
    //     private trusteeModel:mongoose.Model<Trustee>
    // ){}

    // async findTrustee():Promise<Trustee[]>{
    //     const trustee = await this.trusteeModel.find()
    //     return trustee
    // }
}

import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeSchema } from 'src/trustee/schemas/trustee.schema';
@Module({
    // imports:[MongooseModule.forFeature([{name:'Trustee',schema:TrusteeSchema}])],
    // controllers:[ApiController],
    // providers:[ApiService]
})
export class ApiModule {
    // imports:[MongooseModule.forFeature([{name:'Trustee',schema:TrusteeSchema}])]
    // controllers:[ApiController]
    // provider:[ApiService]
}

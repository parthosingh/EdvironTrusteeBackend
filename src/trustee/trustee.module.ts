import { Module } from '@nestjs/common';
import { TrusteeController } from './trustee.controller';
import { TrusteeService } from './trustee.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeSchema } from './schemas/trustee.schema';

@Module({
  imports:[MongooseModule.forFeature([{name: 'Trustee',schema: TrusteeSchema}])],
  controllers: [TrusteeController],
  providers: [TrusteeService]
})
export class TrusteeModule {}

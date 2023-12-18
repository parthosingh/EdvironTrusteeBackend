import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeController } from './trustee.controller';
import { TrusteeService } from './trustee.service';
import { TrusteeSchema } from './schema/trustee.schema';
import { JwtModule } from '@nestjs/jwt';
import { config } from 'dotenv';
import { SchoolSchema } from './schema/school.schema';
config();

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([{name:'TrusteeSchool',schema:SchoolSchema}]),
    JwtModule.registerAsync({
      useFactory: () => ({
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  controllers: [TrusteeController],
  providers: [TrusteeService],
})
export class TrusteeModule {}
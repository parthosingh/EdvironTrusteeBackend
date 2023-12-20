import { Module } from '@nestjs/common';
import { ErpService } from './erp.service';
import { ErpController } from './erp.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeSchema } from 'src/schema/trustee.schema';
import { SchoolSchema } from 'src/schema/school.schema';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([{name:'TrusteeSchool',schema:SchoolSchema}]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET_FOR_API_KEY,
        signOptions: { expiresIn: '2h' },
      }),
    })
  ],
  providers: [ErpService],
  controllers: [ErpController]
})
export class ErpModule {}

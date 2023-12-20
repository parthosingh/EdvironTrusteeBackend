import { Module } from '@nestjs/common';
import { MainBackendService } from './main-backend.service';
import { MainBackendController } from './main-backend.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { TrusteeSchema } from 'src/schema/trustee.schema';
import { SchoolSchema } from 'src/schema/school.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([{ name: 'TrusteeSchool', schema: SchoolSchema }]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret:process.env.JWT_SECRET_FOR_INTRANET,
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [MainBackendService],
  controllers: [MainBackendController]
})
export class MainBackendModule {}

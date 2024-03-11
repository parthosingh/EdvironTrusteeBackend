import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from 'dotenv';
import { TrusteeModule } from './trustee/trustee.module';
import { ErpModule } from './erp/erp.module';
import { MainBackendModule } from './main-backend/main-backend.module';
import { PlatformChargesModule } from './platform-charges/platform-charges.module';
import { ScheduleModule } from '@nestjs/schedule';
config();

@Module({
  imports: [
    MongooseModule.forRoot(process.env.DB),
    TrusteeModule,
    ErpModule,
    MainBackendModule,
    PlatformChargesModule
    ScheduleModule.forRoot()
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

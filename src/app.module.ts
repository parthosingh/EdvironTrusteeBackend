import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import {config} from 'dotenv'
import { TrusteeModule } from './trustee/trustee.module';
import { ErpModule } from './erp/erp.module';
config()

@Module({ 
  
  imports: [MongooseModule.forRoot(process.env.DB),TrusteeModule, ErpModule],
  
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {} 
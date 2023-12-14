import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiController } from './api/api.controller';
import { ApiService } from './api/api.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeModule } from './trustee/trustee.module';
import {config} from 'dotenv'
// import './dotenv.setup'
config()

@Module({ 
  
  imports: [MongooseModule.forRoot(process.env.DB),TrusteeModule],
  controllers: [AppController, ApiController],
  providers: [AppService, ApiService,],
})
export class AppModule {} 

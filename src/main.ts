import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import './dotenv.setup'


// console.log(process.env.PASS,'pp'); 
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
 
  // add whitelisted URL
  const whitelist =[
    'http://192.168.1.106:8080'
  ] 
  app.enableCors({
    origin: function (origin, callback) {
      if (whitelist.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        // callback(new Error('Not allowed by CORS'))
        callback(null, false);
      }
    },
    credentials: true,
  });

  await app.listen(3000,'0.0.0.0');// remove global ip i added for testing only 
}
bootstrap();

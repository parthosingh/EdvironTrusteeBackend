import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';




async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const whitelist = [
    'http://localhost:3001',
    'http://localhost:3000',
    'https://www.edviron.com',
    'https://edviron.com',
    'https://dashboard.edviron.com',
    'https://dev.dashboard.edviron.com',
    'https://qa.dashboard.edviron.com',
    'https://pay.edviron.com',
    'https://dev.pay.edviron.com',
    'https://qa.pay.edviron.com',
    'https://admin.edviron.com',
    'https://dev.admin.edviron.com',
    'https://qa.admin.edviron.com',
    'https://onboarding.edviron.com',
    'https://dev.onboarding.edviron.com',
    'https://qa.onboarding.edviron.com',
    'https://dev.trustee.edviron.com',
    'https://dev.api.edviron.com/'
  ];
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
  await app.listen(process.env.PORT, ()=>{
    console.log(`\x1b[1m\x1b[32m>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> VANILLA SERVICE STARTED ON PORT \x1b[33m${process.env.PORT}\x1b[32m <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\x1b[0m`);
  });
}
bootstrap();

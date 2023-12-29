import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT, () => {
    console.log(
      `\x1b[1m\x1b[32m>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> VANILLA SERVICE STARTED ON PORT \x1b[33m${process.env.PORT}\x1b[32m <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\x1b[0m`,
    );
  });
}
bootstrap();

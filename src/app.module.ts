import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiController } from './api/api.controller';
import { ApiService } from './api/api.service';
// import { ApiKeyModule } from './api/api_key/api_key.module';
// import { SectionModule } from './api/section/section.module';
// import { StudentModule } from './api/student/student.module';
// import { SchoolModule } from './api/school/school.module';

@Module({
  imports: [
    // ApiKeyModule, SectionModule, StudentModule, SchoolModule
  ],
  controllers: [AppController, ApiController],
  providers: [AppService, ApiService],
})
export class AppModule {}

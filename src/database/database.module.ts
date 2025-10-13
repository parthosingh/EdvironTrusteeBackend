import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentDetail, StudentDetailSchema } from 'src/schema/student.schema';
import { DatabaseService } from './database.service';
import { TrusteeSchool } from 'src/schema/school.schema';
import { TrusteeSchema } from 'src/schema/trustee.schema';

@Module({
    imports: [
        MongooseModule.forRoot(process.env.DB!),
        MongooseModule.forFeature([
            { name: StudentDetail.name, schema: StudentDetailSchema },
        ]),
        MongooseModule.forFeature([
            { name: TrusteeSchool.name, schema: TrusteeSchema },
        ]),
    ],
    providers: [DatabaseService],
    exports: [
        DatabaseService,
        MongooseModule.forFeature([
            { name: StudentDetail.name, schema: StudentDetailSchema },
            { name: TrusteeSchool.name, schema: TrusteeSchema },
        ]),
    ]
})
export class DatabaseModule { }

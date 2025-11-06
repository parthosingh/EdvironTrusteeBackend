import { BadGatewayException, BadRequestException, Body, Injectable, Post, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
@Injectable()
export class CanteenService {
    constructor(private readonly databaseService: DatabaseService) { }


    async authStudent(
        token: string
    ) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET_FOR_CANTEEN!);
            const { student_id, school_id } = decoded as any;
            const student = await this.databaseService.studentModel.findOne({ student_id, school_id: new Types.ObjectId(school_id) }).exec();
            if (!student) {
                throw new UnauthorizedException("Invalid Credentials");
            }
            return decoded;
        } catch (e) {
            throw new BadGatewayException(e.message);
        }
    }

    async createStudent(
        email: string,
        student_id: string,
        student_name: string,
        student_number: string,
        passsword: string,
        password: string,
        trustee_id: string,
        school_id: string
    ) {
        try {
            const existingStudent = await this.databaseService.studentModel.findOne({ student_id, school_id: new Types.ObjectId(school_id) }).exec();
            if (existingStudent) {
                throw new BadGatewayException("Student with this ID already exists");
            }
            const student = new this.databaseService.studentModel({
                student_id,
                student_name,
                student_email: email,
                student_number,
                password_hash: password,
                trustee_id,
                school_id: new Types.ObjectId(school_id)
            });
            await student.save();
            return {
                message: "Student created successfully",
                status_code: '200',
                students: {
                    student_id: student.student_id,
                    student_name: student.student_name,
                    student_email: student.student_email,
                }
            }
        } catch (e) {
            throw new BadGatewayException(e.message);
        }
    }

    async studentLogin(
        student_id: string,
        password: string,
        school_id: string
    ) {
        try {

            const student = await this.databaseService.studentModel.findOne({ student_id, school_id: new Types.ObjectId(school_id) }).exec();
            if (!student) {
                throw new UnauthorizedException("Invalid Credentials");
            }
            const passwordMatch = await bcrypt.compare(password, student.password_hash);
            if (!passwordMatch) {
                throw new UnauthorizedException("Invalid Credentials");
            }

            const payload = {
                student_id: student.student_id,
                student_name: student.student_name,
                student_email: student.student_email,
                school_id: student.school_id,
                trustee_id: student.trustee_id,
            }
            const token = jwt.sign(payload, process.env.JWT_SECRET_FOR_CANTEEN!, { expiresIn: '7d' });

            return {
                token,
                student: payload
            }

        } catch (error) {
            throw new BadGatewayException(error.message);
        }
    }

    async authSchool(
        school_id: string,
        sign: string
    ) {
        try {
            if (!process.env.JWT_SECRET_FOR_CANTEEN) {
                throw new BadRequestException('Canteen Auth Required')
            }
            const decoded = jwt.verify(sign, process.env.JWT_SECRET_FOR_CANTEEN) as any;

            if (decoded.school_id !== school_id) {
                throw new BadGatewayException(`Request Fordge | Invalid Sign`)
            }
            const school = await this.databaseService.trusteeSchoolModel.findOne({
                school_id: new Types.ObjectId(school_id)
            })
            if(!school){
                throw new BadRequestException(`Invalid Schoo ID`)
            }
            return {
                school_id,
                school_name:school.school_name,
                school_email:school.email || 'NA',
                school_number:school.phone_number || 'NA',
                trustee_id:school.trustee_id,
                logo:school.logo || null
            }

        } catch (e) {
            throw new BadGatewayException(e.message)
        }
    }
}

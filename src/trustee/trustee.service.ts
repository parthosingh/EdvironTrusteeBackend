import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Trustee } from './schema/trustee.schema';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
@Injectable()
export class TrusteeService {
  constructor(
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    private readonly jwtService: JwtService,
  ) {}
  async createStudent(Student, schoolId, userId) {
    try {
      const publicKey = process.env.PUBLIC_KEY;
      const info = {
        ...Student,
        schoolId: schoolId,
        userId: userId,
      };
      const token = this.jwtService.sign(info, {
        secret: publicKey,
        expiresIn: '2h',
      });
      const student = await axios.post(
        `${process.env.MAIN_SERVER_URL}/createStudent`,
        {
          token: token,
        },
      );
      return student.data;
    } catch (error) {
      if (error.response.data.statusCode === 409) {
        throw new ConflictException(error.response.data.message);
      }
      throw new BadRequestException(error.message);
    }
  }
}

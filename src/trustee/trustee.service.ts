import { JwtService } from '@nestjs/jwt';
import mongoose, { Types } from 'mongoose';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Trustee } from '../schema/trustee.schema';
import { TrusteeSchool } from '../schema/school.schema';
import axios from 'axios';
import * as bcrypt from 'bcrypt';
import * as nodemailer from "nodemailer";
import * as path from 'path';
import * as fs from 'fs';
import * as handlebars from 'handlebars';

@Injectable()
export class TrusteeService {
  constructor(
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    private jwtService: JwtService,
  ) { }



  async loginAndGenerateToken(
    emailId: string,
    passwordHash: string,
  ): Promise<{ token: string }> {
    try {
      const trustee = await this.trusteeModel.findOne({ email_id: emailId });
      if (!trustee) {
        throw new UnauthorizedException('Invalid credentials');
      }
      const passwordMatch = await bcrypt.compare(
        passwordHash,
        trustee.password_hash,
      );

      if (!passwordMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }
      const payload = {
        id: trustee._id,
      };

      return {
        token: await this.jwtService.sign(payload, {
          secret: process.env.JWT_SECRET_FOR_TRUSTEE_AUTH,
          expiresIn: '30d',
        }),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async validateTrustee(token: string): Promise<any> {
    try {
      const decodedPayload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_TRUSTEE_AUTH,
      });

      const trustee = await this.trusteeModel.findById(decodedPayload.id);

      if (!trustee) throw new NotFoundException('trustee not found');
      const userTrustee = {
        id: trustee._id,
        name: trustee.name,
        email: trustee.email_id,
        apiKey: trustee.apiKey || null,
      };
      return userTrustee;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async getSchools(trusteeId: string, page: number) {
    try {
      if (!Types.ObjectId.isValid(trusteeId)) {
        throw new BadRequestException('Invalid trusteeID format');
      }
      const trusteeObjectId = new mongoose.Types.ObjectId(trusteeId);

      const trustee = await this.trusteeModel.findById(trusteeId);

      if (!trustee) {
        throw new ConflictException(`no trustee found`);
      }
      const count = await this.trusteeSchoolModel.countDocuments({
        trustee_id: trusteeObjectId,
      });
      const pageSize = 10;
      const schools = await this.trusteeSchoolModel
        .find(
          { trustee_id: trusteeObjectId },
          { school_id: 1, school_name: 1, pg_key:1,email:1, _id: 0 },
        )
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();
      return { schoolData: schools, total_pages: Math.ceil(count / pageSize) };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }
  async getTrusteeSchools(trusteeId: string, page: number) {

    try {
      if (!Types.ObjectId.isValid(trusteeId)) {
        throw new BadRequestException('Invalid trusteeID format');
      }
      const trusteeObjectId = new mongoose.Types.ObjectId(trusteeId);

      const trustee = await this.trusteeModel.findById(trusteeId);

      if (!trustee) {
        throw new ConflictException(`no trustee found`);
      }
      const count = await this.trusteeSchoolModel.countDocuments({
        trustee_id: trusteeObjectId,
      });
      const pageSize = 10;
      const schools = await this.trusteeSchoolModel
        .find(
          { trustee_id: trusteeObjectId }
        )
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();


      return { schoolData: schools, total_pages: Math.ceil(count / pageSize) };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }

  async generateSchoolToken(
    schoolId: string,
    password: string,
    trusteeId: string,
  ) {
    try {
      const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
      // Parallel execution of database queries using Promise.all()
      const [school, trustee] = await Promise.all([
        this.trusteeSchoolModel.findOne({ school_id: schoolObjectId }),
        this.trusteeModel.findById(trusteeId),
      ]);

      // Specific error handling using custom error classes
      if (!trustee) {
        throw new NotFoundException('Trustee not found');
      }
      if (!school) {
        throw new NotFoundException('School not found!');
      }
      if (school.trustee_id.toString() !== trustee._id.toString())
        throw new NotFoundException('School not found for trustee');

      // Password validation and JWT token generation
      const passwordMatch = await bcrypt.compare(
        password,
        trustee.password_hash,
      );
      if (!passwordMatch) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const data = { schoolId: school.school_id };
      const token = this.jwtService.sign(data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      // Making a POST request to an external endpoint
      const schoolToken = await axios.post(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/gen-school-token`,
        {
          token: token,
        },
      );
      return schoolToken.data;
    } catch (error) {
      // Structured error handling for different scenarios
      if (error.response) {
        throw error;
      } else if (error.request) {
        throw new BadRequestException('No response received from the server');
      } else if (
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      )
        throw error;
      else {
        throw new BadRequestException('Request setup error');
      }
    }
  }

  async sendMails(email, mailOptions) {
    try {

      const transporter = nodemailer.createTransport({
        pool: true,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          type: 'OAuth2',
          user: process.env.EMAIL_USER,
          clientId: process.env.OAUTH_CLIENT_ID,
          clientSecret: process.env.OAUTH_CLIENT_SECRET,
          refreshToken: process.env.OAUTH_REFRESH_TOKEN
        },
      });


      const info = await transporter.sendMail(mailOptions);
      return true
    } catch (error) {
      console.log(error);

      throw new BadRequestException(error.message)
    }
  }

  async sentResetMail(email) {
    try {
      const trustee = await this.trusteeModel.findOne({ email_id: email })
      if (!trustee) {
        throw new NotFoundException('Trustee Not Found')
      }

      const expirationTime = Math.floor(Date.now() / 1000) + 1 * 60; // 30 minutes
      const secretKey = process.env.JWT_SECRET_FOR_RESETPASSWORD_LINK;
      const data = {
        email: email,
        // exp: expirationTime
      }
      const token = this.jwtService.sign(data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
        expiresIn: expirationTime //30 mins
      });

      const resetURL = `${process.env.TRUSTEE_DASHBOARD_URL}/reset-password?token=${token}`
      const __dirname = path.resolve();
      const filePath = path.join(__dirname, 'src/trustee/reset-mail-template.html');
      const source = fs.readFileSync(filePath, 'utf-8').toString();
      const template = handlebars.compile(source);

      const replacements = {
        email: email,
        url: resetURL
      };

      const htmlToSend = template(replacements);



      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Reset password",
        html: htmlToSend
      };
      // const info = await transporter.sendMail(mailOptions);
      await this.sendMails(email, mailOptions)
      return true
    } catch (error) {
      console.log(error);

      throw new BadRequestException(error.message)
    }
  }

  async resetPassword(email, password) {
    try{

      const trustee = await this.trusteeModel.findOne({ email_id: email })
      if (!trustee) {
        throw new NotFoundException('Trustee Not Found')
      }
      
      trustee.password_hash = password
      await trustee.save()
      return true
    }catch(error){
      throw new BadRequestException(error.message)
    }
  }

  async verifyresetToken(token) {
    try {
      const data = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET
      })
      return true
    } catch (err) {
      // console.log(err);
      return false
    }
  }

}

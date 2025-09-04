import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import axios from 'axios';
import { Trustee } from 'src/schema/trustee.schema';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { TrusteeService } from 'src/trustee/trustee.service';
import * as nodemailer from 'nodemailer';
import { SubTrustee } from 'src/schema/subTrustee.schema';
import { count } from 'console';
import { Types } from 'mongoose';
var loginOtps: any = {};
var resetOtps: any = {}; //reset password
var editOtps: any = {};
var editOtpTimeouts: any = {};
var loginOtpTimeouts: any = {};
var resetOtpTimeouts: any = {};

@Injectable()
export class SubTrusteeService {
    constructor(
        @InjectModel(SubTrustee.name)
        private subTrustee: mongoose.Model<SubTrustee>,
        @InjectModel(Trustee.name)
        private trusteeModel: mongoose.Model<Trustee>,
        private jwtService: JwtService,
    ) { }

    async validateMerchant(token: string): Promise<any> {
        try {
            if (!token) return;
            const decodedPayload = this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET_FOR_SUBTRUSTEE_AUTH,
            });
            const subTrustee = await this.subTrustee.findById(
                decodedPayload.id,
            )
            if (!subTrustee) {
                throw new BadRequestException('sub trustee not found')
            }
            let trustee = await this.trusteeModel.findById(subTrustee.trustee_id);
            const userMerchant = {
                id: subTrustee._id,
                name: subTrustee.name,
                email: subTrustee.email,
                role: subTrustee.role,
                phone: subTrustee.phone,
                apiKey: trustee.apiKey,
                subTrustee: subTrustee._id,
                trustee_id: trustee._id,
                logo: subTrustee.logo || null,
            };
            return userMerchant;
        } catch (error) {
            console.log(error);
            throw new UnauthorizedException('Invalid token');
        }
    }

    async loginAndGenerateToken(
        email: string,
        passwordHash: string,
    ): Promise<Boolean> {
        try {
            const lowerCaseEmail = email.toLowerCase();
            var res = false;
            const subtrustee = await this.subTrustee.findOne({ email: lowerCaseEmail });
            console.log(subtrustee, "subtrustee")
            var email_id = subtrustee?.email;
            let passwordMatch = await bcrypt.compare(
                passwordHash,
                subtrustee.password_hash,
            );
            if (!passwordMatch) {
                throw new UnauthorizedException('Invalid credentials');
            }
            if ((await this.sendLoginOtp(email_id)) == true) res = true;
            return res;
        } catch (error) {
            console.log(error);
            throw new UnauthorizedException('Invalid credentials');
        }
    }

    async sendLoginOtp(email: string) {
        if (!email) {
            throw new BadRequestException('Invalid email');
        }
        const subtrustee = await this.subTrustee.findOne({
            email: email,
        });
        if (!subtrustee) {
            throw new NotFoundException('subtrustee not found')
        }
        var email_id = subtrustee?.email;

        const otp = Math.floor(100000 + Math.random() * 900000);
        loginOtps[email_id] = otp;
        if (loginOtpTimeouts[email_id]) {
            clearTimeout(loginOtpTimeouts[email_id]);
        }

        loginOtpTimeouts[email_id] = setTimeout(() => {
            delete editOtps[email_id];
            console.log('Merchant login otp deleted for ', { email_id });
        }, 180000);
        this.sendOTPMail(
            email_id,
            'OTP',
            `${otp}`,
            'src/sub-trustee/otp-template.html',
            subtrustee,
        );
        return true;
    }

    async sendOTPMail(
        email_id: string,
        subject: string,
        text: string,
        template_path: string,
        school?: any,
    ) {
        if (!email_id) throw new Error('Invalid email id');
        const __dirname = path.resolve();
        const filePath = path.join(__dirname, template_path);
        const source = fs.readFileSync(filePath, 'utf-8').toString();
        const template = handlebars.compile(source);
        const replacements = {
            otp: text,
            school: school?.name,
        };
        const htmlToSend = template(replacements);
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email_id,
            subject: subject,
            text: text,
            html: htmlToSend,
        };
        await this.sendMails(email_id, mailOptions);
        console.log('mail sent', { email_id, subject, text });
        return true;
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
                    refreshToken: process.env.OAUTH_REFRESH_TOKEN,
                },
            });
            const info = await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.log(error);
            throw new BadRequestException(error.message);
        }
    }

    async validateLoginOtp(otp: string, email: string) {
        if (loginOtps[email] == otp) {
            delete loginOtps[email];
            const merchant = await this.subTrustee.findOne({
                email: email,
            });
            let payload = {
                id: merchant._id,
                role: merchant.role
            };
            const token = this.jwtService.sign(payload, {
                secret: process.env.JWT_SECRET_FOR_SUBTRUSTEE_AUTH,
            });
            return token;
        } else {
            throw new Error('Invalid OTP');
        }
    }

    async getSubTrusteeSchools(
        subTrusteeId: string,
        page: number,
        limit: number,
        searchQuery?: string,
        kycStatus?: string[],
    ) {
        try {
            const subTrustee = await this.subTrustee.findById(subTrusteeId);
            if (!subTrustee) {
                throw new NotFoundException('Sub-trustee not found');
            }
            const trusteeId = subTrustee.trustee_id;
            let searchFilter: any = {
                trustee_id: trusteeId,
                subtrustee_ids: { $in: [new Types.ObjectId(subTrusteeId)] }
            };
            if (searchQuery) {
                if (searchQuery) {
                    searchFilter = {
                        ...searchFilter,
                        $or: [
                            { school_name: { $regex: searchQuery, $options: 'i' } },
                            { email: { $regex: searchQuery, $options: 'i' } },
                            { pg_key: { $regex: searchQuery, $options: 'i' } },
                        ],
                    };
                }

            }

            if (kycStatus && kycStatus.length > 0) {
                searchFilter = {
                    ...searchFilter,
                    merchantStatus: { $in: kycStatus },
                };
            }
            const countDocs = await this.trusteeModel.countDocuments(searchFilter);
            const schools = await this.trusteeModel.find(searchFilter).skip((page - 1) * limit).limit(limit);

            const schoolsWithBankDetails = await Promise.all(
                schools.map(async (school: any) => {
                    try {
                        const school_id = school.school_id.toString();
                        const tokenAuth = this.jwtService.sign(
                            { school_id },
                            { secret: process.env.JWT_SECRET_FOR_INTRANET! },
                        );
                        const response = await axios.get(
                            `${process.env.MAIN_BACKEND_URL}/api/trustee/get-school-kyc?school_id=${school_id}&token=${tokenAuth}`,
                        );

                        const bankDetails = {
                            account_holder_name:
                                response?.data?.bankDetails?.account_holder_name ||
                                school.bank_details?.account_holder_name ||
                                null,
                            account_number:
                                response?.data?.bankDetails?.account_number ||
                                school.bank_details?.account_number ||
                                null,
                            ifsc_code:
                                response?.data?.bankDetails?.ifsc_code ||
                                school.bank_details?.ifsc_code ||
                                null,
                        };
                        return {
                            ...school,
                            bank_details: bankDetails,
                        };
                    } catch (error) {
                        console.error(
                            `Failed to fetch bank details for school_id: ${school.school_id}`,
                            error.message,
                        );
                        return {
                            ...school,
                            // bank_details: null,
                        };
                    }
                }),
            );

            const totalPages = Math.ceil(countDocs / limit);


            return {
                schoolData: schoolsWithBankDetails,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: countDocs,
                },
            };
        } catch (error) {
            console.log(error);
            throw new BadRequestException(error.message);
        }
    }

}
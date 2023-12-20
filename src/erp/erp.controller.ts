import {
    Controller,
    Post,
    Get,
    Body,
    BadRequestException,
    ConflictException,
    Query,
    Req,
    UnauthorizedException,
    NotFoundException,
} from '@nestjs/common';
import { ErpService } from './erp.service';
import { JwtService } from '@nestjs/jwt';


@Controller('erp')
export class ErpController {
    constructor(
        private erpService: ErpService,
        private readonly jwtService: JwtService,
    ) { }

    @Get('payment-link')
    async genratePaymentLink(
        @Query('phone_number')
        phone_number: string,
    ) {
        const link = this.erpService.genrateLink(phone_number);
        return link;
    }

    @Get('get-user')
    async validateApiKey(@Req() req): Promise<{ payload: any }> {
        try {
            // If the request reaches here, the token is valid
            const authorizationHeader = req.headers.authorization;
            const token = authorizationHeader.split(' ')[1];

            const trustee = await this.erpService.validateApiKey(token);

            return trustee;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw new NotFoundException(error.message);
            } else {
                throw new UnauthorizedException(error.message);
            }
        }
    }

    @Post('section')
    async createSection(
        @Body()
        body: {
            school_id: string;
            data: { className: string; section: string };
        },
    ) {
        try {
            const section = await this.erpService.createSection(
                body.school_id,
                body.data,
            );
            return section;
        } catch (error) {
            if (error.response.statusCode === 409) {
                throw new ConflictException(error.message);
            }
            throw new BadRequestException(error.message);
        }
    }

    @Post('createStudent')
    async createStudent(
        @Body()
        body,
    ) {
        try {
            const student = await this.erpService.createStudent(
                body,
                body.schoolId,
                body.userId,
            );
            return student;
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

}

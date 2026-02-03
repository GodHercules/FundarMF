import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Response, Request } from "express";
import { AuthService } from "./auth.service";
import { RequestLinkDto } from "./dto/request-link.dto";
import { VerifyLinkDto } from "./dto/verify-link.dto";
import { LoginDto } from "./dto/login.dto";
import { SessionService } from "./session.service";
import { AuthGuard } from "../../common/auth/auth.guard";
import { ResendOtpDto } from "./dto/resend-otp.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly sessionService: SessionService) {}

  @Post("customer/request-link")
  async requestLink(@Body() dto: RequestLinkDto) {
    return this.authService.requestCustomerLink(dto.email, dto.whatsapp);
  }

  @Post("customer/verify")
  async verify(@Body() dto: VerifyLinkDto, @Res({ passthrough: true }) res: Response) {
    const { sessionToken } = await this.authService.verifyCustomerLink(dto.token, dto.otp);
    res.cookie(this.sessionService.cookieName, sessionToken, this.sessionService.buildCookieOptions());
    return { ok: true };
  }

  @Post("customer/resend-otp")
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendCustomerOtp(dto.token);
  }

  @Post("operator/login")
  async loginOperator(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token } = await this.authService.loginUser(dto.email, dto.password, "OPERATOR");
    res.cookie(this.sessionService.cookieName, token, this.sessionService.buildCookieOptions());
    return { ok: true };
  }

  @Post("master/login")
  async loginMaster(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token } = await this.authService.loginUser(dto.email, dto.password, "MASTER");
    res.cookie(this.sessionService.cookieName, token, this.sessionService.buildCookieOptions());
    return { ok: true };
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.sessionId, req.actor);
    res.clearCookie(this.sessionService.cookieName);
    return { ok: true };
  }

  @UseGuards(AuthGuard)
  @Get("me")
  async me(@Req() req: Request) {
    return { actor: req.actor };
  }
}

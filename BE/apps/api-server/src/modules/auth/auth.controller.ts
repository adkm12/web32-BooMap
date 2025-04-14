import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from '../user/user.service';
import { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { UserCreateDto } from '../user/dto';

export interface AuthenticatedRequest extends Request {
  user: {
    id?: number;
    email: string;
    name?: string;
  };
  cookies: {
    refreshToken?: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubLogin() {}

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubLoginCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const email = req.user.email;
    let user = await this.userService.findByEmail(email, 'github');

    if (!user) {
      const newUser = plainToInstance(UserCreateDto, req.user);
      user = await this.userService.createUser(newUser, 'github');
    }

    const refreshToken = this.authService.generateRefreshToken(user);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true });
    res.redirect(`/auth`);
  }

  @Get('kakao')
  @UseGuards(AuthGuard('kakao'))
  async kakaoLogin() {}

  @Get('kakao/callback')
  @UseGuards(AuthGuard('kakao'))
  async kakaoLoginCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const email = req.user.email;
    let user = await this.userService.findByEmail(email, 'kakao');

    if (!user) {
      const newUser = plainToInstance(UserCreateDto, req.user);
      user = await this.userService.createUser(newUser, 'kakao');
    }

    const refreshToken = this.authService.generateRefreshToken(user);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true });
    res.redirect(`/auth`);
  }

  @Post('refresh')
  async refresh(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const refreshToken = req.cookies.refreshToken;
    const accessToken = await this.authService.verifiedRefreshToken(refreshToken);
    res.json({ accessToken });
  }

  @Post('logout')
  async logout(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const refreshToken = req.cookies.refreshToken;
    if (typeof refreshToken === 'string') {
      await this.authService.logout(refreshToken);
      res.clearCookie('refreshToken');
      res.json({ message: 'success' });
    }
  }
}

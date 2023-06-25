import { Request, Response, NextFunction } from 'express';
import { inject, injectable } from 'inversify';
import { sign } from 'jsonwebtoken';

import { TYPES } from '../../types';
import { IControllerRoute } from '../../common/interfaces/IControllerRoute';
import { ILoggerService } from '../../logger/ILoggerService';
import { IUserController } from './interfaces/IUserController';
import { IUserService } from './interfaces/IUserService';

import { ValidateMiddleware } from '../../common/middlewares/validate.middleware';
import { BaseController } from '../../common/base.controller';
import { AuthGuard } from '../../common/guards/auth.guard';

import { IConfigService } from '../../config/IConfigService';
import { HttpError } from '../../errors/HttpError';
import { UserLoginDto } from './dto/user-login.dto';
import { UserRegisterDto } from './dto/user-register.dto';

@injectable()
export class UserController extends BaseController implements IUserController {
  readonly routes: IControllerRoute[] = [
    {
      path: '/login',
      method: 'post',
      callback: this.login,
      middlewares: [new ValidateMiddleware(UserLoginDto)],
    },
    {
      path: '/register',
      method: 'post',
      callback: this.register,
      middlewares: [new ValidateMiddleware(UserRegisterDto)],
    },
    {
      path: '/info',
      method: 'get',
      callback: this.info,
      middlewares: [new AuthGuard()],
    },
  ];

  constructor(
    @inject(TYPES.ConfigService) private _configService: IConfigService,
    @inject(TYPES.Logger) private _logger: ILoggerService,
    @inject(TYPES.UserService) private _userService: IUserService,
  ) {
    super(_logger);
    this.bindRoutes(this.routes);
  }

  public async login(
    { body }: Request<any, any, UserLoginDto>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = await this._userService.loginUser(body);
    if (!userId) {
      return next(new HttpError(401, 'Authorization error', 'Login'));
    }

    const jwt = await this.#signJWT(body.email, userId, this._configService.getConfig('SECRET'));
    this.success(res, { accessToken: jwt });
  }

  async register(
    { body }: Request<any, any, UserRegisterDto>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const result = await this._userService.createUser(body);
    if (!result) return next(new HttpError(422, 'Registration error', 'Register'));

    this.success(res, result);
  }

  async info({ email }: Request, res: Response, next: NextFunction): Promise<void> {
    const result = await this._userService.getUserInfo(email);
    if (!result) return next(new HttpError(401, 'Authorization error', 'Info'));

    this.success(res, result);
  }

  #signJWT(email: string, userId: number | boolean, secret: string): Promise<string> {
    return new Promise((resolve, reject) => {
      sign(
        {
          email,
          userId,
          iat: Math.floor(Date.now() / 1000),
        },
        secret,
        { algorithm: 'HS256' },
        (e: unknown, token: string) => {
          if (e) reject(e);
          resolve(token);
        },
      );
    });
  }
}

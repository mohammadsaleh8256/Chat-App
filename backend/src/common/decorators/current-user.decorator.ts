import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  id: string;
  phoneNumber: string;
  role: 'USER' | 'ADMIN';
  jwtId: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext): CurrentUserPayload | string => {
    const req = ctx.switchToHttp().getRequest();
    const user: CurrentUserPayload = req.user;
    return data ? user?.[data] : user;
  },
);

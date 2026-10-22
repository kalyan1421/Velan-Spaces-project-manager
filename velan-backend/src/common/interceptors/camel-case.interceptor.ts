import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { camelizeKeys } from '../case';

/** Converts every JSON response body to camelCase keys (see common/case.ts). */
@Injectable()
export class CamelCaseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((body) => camelizeKeys(body)));
  }
}

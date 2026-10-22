import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, mergeMap } from 'rxjs';
import { StorageSignerService } from '../../modules/storage/storage-signer.service';
import { isRef } from '../../modules/storage/storage-refs';

function collectRefs(value: unknown, into: Set<string>): void {
  if (isRef(value)) {
    into.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectRefs(v, into);
  } else if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const v of Object.values(value)) collectRefs(v, into);
  }
}

function replaceRefs(value: unknown, signed: Map<string, string>): unknown {
  if (isRef(value)) return signed.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => replaceRefs(v, signed));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = replaceRefs(v, signed);
    return out;
  }
  return value;
}

/**
 * Replaces every `sb://bucket/path` string in a response with a signed
 * download URL. Rows only ever hold refs that were validated on write to be
 * inside the row's own project folder (see storage-refs.ts), so a caller who
 * may read the row may also read the files it points to.
 */
@Injectable()
export class SignStorageRefsInterceptor implements NestInterceptor {
  constructor(private readonly signer: StorageSignerService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      mergeMap((body) => {
        const refs = new Set<string>();
        collectRefs(body, refs);
        if (refs.size === 0) return from([body]);
        return from(this.signer.signRefs([...refs]).then((signed) => replaceRefs(body, signed)));
      }),
    );
  }
}

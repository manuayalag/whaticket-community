// Declaración de tipos para node-fetch
declare module 'node-fetch' {
  export default function fetch(
    url: string | Request,
    init?: RequestInit
  ): Promise<Response>;
  
  export class Request {
    constructor(input: string | Request, init?: RequestInit);
    readonly url: string;
    readonly headers: Headers;
    readonly method: string;
    readonly body: ReadableStream | null;
    readonly bodyUsed: boolean;
    clone(): Request;
  }
  
  export class Response {
    constructor(body?: BodyInit | null, init?: ResponseInit);
    readonly type: ResponseType;
    readonly url: string;
    readonly status: number;
    readonly ok: boolean;
    readonly statusText: string;
    readonly headers: Headers;
    readonly body: ReadableStream | null;
    readonly bodyUsed: boolean;
    clone(): Response;
    text(): Promise<string>;
    json(): Promise<any>;
    buffer(): Promise<Buffer>;
    arrayBuffer(): Promise<ArrayBuffer>;
    formData(): Promise<FormData>;
  }
  
  export class Headers {
    constructor(init?: HeadersInit);
    get(name: string): string | null;
    has(name: string): boolean;
    set(name: string, value: string): void;
    append(name: string, value: string): void;
    delete(name: string): void;
    forEach(callback: (value: string, name: string) => void): void;
  }
  
  export type HeadersInit = Headers | Record<string, string> | Array<[string, string]>;
  export type RequestInfo = Request | string;
  export type RequestInit = {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit;
    redirect?: RequestRedirect;
    signal?: AbortSignal;
    follow?: number;
    timeout?: number;
    compress?: boolean;
    size?: number;
    agent?: any;
  };
  export type BodyInit = ArrayBuffer | ArrayBufferView | string | null | URLSearchParams | ReadableStream<Uint8Array>;
  export type RequestRedirect = 'follow' | 'error' | 'manual';
  export type ResponseType = 'basic' | 'cors' | 'default' | 'error' | 'opaque' | 'opaqueredirect';
  export type ResponseInit = {
    status?: number;
    statusText?: string;
    headers?: HeadersInit;
  };
}

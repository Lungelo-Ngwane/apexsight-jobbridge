// @vitest-environment node
import { expect, it } from 'vitest';
import { bearerToken, boundedText, failure, methodResponse, requestObject } from '../supabase/functions/_shared/http';
it('accepts only POST and OPTIONS and requires a bearer token',()=>{
  expect(methodResponse(new Request('http://localhost',{method:'GET'}))?.status).toBe(405);
  expect(methodResponse(new Request('http://localhost',{method:'OPTIONS'}))?.status).toBe(204);
  expect(methodResponse(new Request('http://localhost',{method:'POST'}))).toBeNull();
  expect(()=>bearerToken(new Request('http://localhost'))).toThrow('Unauthorized');
  expect(bearerToken(new Request('http://localhost',{headers:{authorization:'Bearer fictional'}}))).toBe('fictional');
});
it('validates object payloads and bounds streamed bytes without trusting a length header',async()=>{
  await expect(requestObject(new Request('http://localhost',{method:'POST',body:'[]'}))).rejects.toThrow('Invalid object');
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(4));controller.enqueue(new Uint8Array(4));controller.close();}});
  const request=new Request('http://localhost',{method:'POST',body:stream,duplex:'half'} as RequestInit);
  await expect(boundedText(request,7)).rejects.toThrow('Payload too large');
});
it('does not leak server internals in failure responses',async()=>{
  const response=failure(new Error('database schema details and private provider payload'));
  expect(response.status).toBe(500);expect(await response.json()).toEqual({error:'The request could not be completed'});
  expect(failure(new SyntaxError('malformed JSON')).status).toBe(400);
});

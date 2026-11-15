import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isApiError } from "../configs/api";
import { confirmPhoneCode, resendVerificationEmail, sendPhoneCode } from "../service/verificationService";
const envelope = (data: unknown, status=200) => new Response(JSON.stringify({code:0,message:"response success",data}),{status});
const delivery = {phone:"0901234567",expiresAt:"2026-11-14T10:05:00Z"};
const verified = {phone:"0901234567",phoneVerifiedAt:"2026-11-14T10:00:00Z"};
test("verification sends the exact #210 paths, bodyless send, code-only confirmation and public 204 resend", async()=>{
 let token="first"; const calls:unknown[]=[];
 const context={getAccessToken:()=>token,fetch:async(input:RequestInfo|URL,init?:RequestInit)=>{const path=String(input);calls.push({path,method:init?.method,body:init?.body?JSON.parse(String(init.body)):null,bearer:new Headers(init?.headers).get("Authorization")});return path.endsWith("verification-email")?new Response(null,{status:204}):envelope(path.endsWith("/confirm")?verified:delivery,path.endsWith("/confirm")?200:202);}};
 assert.equal(await resendVerificationEmail(" buyer@example.test ",{context}),undefined);
 assert.deepEqual(await sendPhoneCode({context}),delivery);token="rotated";
 assert.deepEqual(await confirmPhoneCode("123456",{context}),verified);
 assert.deepEqual(calls,[{path:"/api/v1/auth/verification-email",method:"POST",body:{email:"buyer@example.test"},bearer:null},{path:"/api/v1/users/me/phone/verification",method:"POST",body:null,bearer:"Bearer first"},{path:"/api/v1/users/me/phone/verification/confirm",method:"POST",body:{code:"123456"},bearer:"Bearer rotated"}]);
 const spec=JSON.parse(readFileSync("docs/api/account-210.openapi.json","utf8"));
 assert.ok(spec.paths["/api/v1/auth/verification-email"].post.responses["204"]);
 assert.ok(spec.paths["/api/v1/users/me/phone/verification"].post.responses["202"]);
 assert.equal(spec.paths["/api/v1/users/me/phone/verification"].get,undefined);
 assert.deepEqual(spec.components.schemas.ConfirmPhoneCode.required,["code"]);
});
test("verification rejects obsolete response shapes and malformed #210 timestamps",async()=>{
 for(const data of [null,{}, {phone:"bad",expiresAt:delivery.expiresAt},{phone:delivery.phone,expiresAt:"invalid"},{retryAfterSeconds:60,expiresInSeconds:300}]) await assert.rejects(sendPhoneCode({context:{fetch:async()=>envelope(data)}}),(e:unknown)=>isApiError(e)&&e.kind==="invalid-response");
 for(const data of [null,{}, {phone:verified.phone,verified:true},{...verified,phoneVerifiedAt:"invalid"}]) await assert.rejects(confirmPhoneCode("123456",{context:{fetch:async()=>envelope(data)}}),(e:unknown)=>isApiError(e)&&e.kind==="invalid-response");
});
test("verification preserves backend symbolic failures and cancellation",async()=>{
 for(const [status,code] of [[400,"PHONE_CODE_INVALID"],[400,"PHONE_CODE_EXPIRED"],[429,"PHONE_CODE_RATE_LIMITED"],[502,"USER_VERIFICATION_EMAIL_FAILED"],[429,"USER_VERIFICATION_EMAIL_RATE_LIMITED"]] as const){
 const options={context:{fetch:async()=>new Response(JSON.stringify({status,code,title:"Rejected"}),{status})}};
 await assert.rejects(code.startsWith("USER")?resendVerificationEmail("buyer@example.test",options):confirmPhoneCode("000000",options),(e:unknown)=>isApiError(e)&&e.status===status&&e.code===code);
 }
 const controller=new AbortController();await assert.rejects(sendPhoneCode({signal:controller.signal,context:{fetch:async()=>{controller.abort();return envelope(delivery,202);}}}),{name:"AbortError"});
});

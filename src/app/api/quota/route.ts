import { currentUser, isAdmin, unauthorized } from "@/lib/auth";
import { DAILY_UPLOAD_LIMIT, uploadsToday } from "@/lib/quota";

/** 오늘 올린 개수와 하루 한도 (헤더의 "오늘 업로드 n/3" 표시용). 관리자면 관리자 메뉴를 보여 준다. */
export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  const used = await uploadsToday(user.id);
  return Response.json({ used, limit: DAILY_UPLOAD_LIMIT, isAdmin: isAdmin(user) });
}

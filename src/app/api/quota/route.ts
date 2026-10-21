import { currentUser, isAdmin, unauthorized } from "@/lib/auth";
import { getUploadLimit, uploadsToday } from "@/lib/quota";

/** 오늘 올린 개수와 하루 한도 (헤더의 "오늘 업로드 1/3" 표시용). 관리자면 관리자 메뉴를 보여 준다. */
export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  const [used, limit] = await Promise.all([uploadsToday(user.id), getUploadLimit()]);
  return Response.json({ used, limit, isAdmin: isAdmin(user) });
}

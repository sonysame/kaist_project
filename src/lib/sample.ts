// 누구나(로그인하지 않아도) 볼 수 있는 샘플 학습 자료: Acquired 팟캐스트 Tencent 편, Atlassian IPO 편
// 보기만 할 수 있고, 삭제·화자 이름 변경 같은 수정은 주인만 한다.
// 첫 번째(Tencent 편)는 처음 쓰는 사람에게 넣어 주는 기본 단어장의 출처이기도 하다.
export const SAMPLE_JOB_ID = "aed3093c-9ae1-4251-bbaf-4ebeaa5982d1";
const ATLASSIAN_JOB_ID = "3aaa62ab-a4c2-4293-b71c-8603030de00a";
export const SAMPLE_JOB_IDS = [SAMPLE_JOB_ID, ATLASSIAN_JOB_ID];

/** 목록에 파일 이름 대신 보여 줄 샘플 제목 */
export const SAMPLE_TITLES: Record<string, string> = {
  [SAMPLE_JOB_ID]: "Acquired 팟캐스트 · Tencent 편",
  [ATLASSIAN_JOB_ID]: "Acquired 팟캐스트 · Atlassian IPO 편",
};

export const isSampleJob = (id: string) => SAMPLE_JOB_IDS.includes(id);

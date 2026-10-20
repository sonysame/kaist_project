import { VocabList } from "@/components/vocab-list";

export const metadata = { title: "단어장 · ListenUp" };

export default function VocabPage() {
  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight">단어장</h1>
      <p className="mt-2 text-sm text-muted">대본에서 저장한 단어예요. 로그인이 없어서 이 브라우저에서 저장한 단어만 보여요.</p>
      <div className="mt-6">
        <VocabList />
      </div>
    </div>
  );
}

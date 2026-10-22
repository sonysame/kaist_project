import { VocabList } from "@/components/vocab-list";

export const metadata = { title: "단어장 · ListenUp" };

export default function VocabPage() {
  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight">단어장</h1>
      <div className="mt-6">
        <VocabList />
      </div>
    </div>
  );
}

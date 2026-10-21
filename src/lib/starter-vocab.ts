// 단어장이 빈 브라우저가 처음 단어장을 열 때 넣어 주는 기본 단어.
// 뜻을 미리 적어 두어서 Gemini를 부르지 않는다. 퀴즈를 바로 풀 수 있게 4개 이상 넣는다.
// 예문은 Acquired 팟캐스트 Tencent 편 대본에서 가져왔다.
export type StarterWord = {
  word: string; // 예문에 나온 그대로의 형태 (빈칸 문제·강조에 씀)
  lemma: string; // 사전형
  part_of_speech: string;
  meaning_ko: string;
  sentence_en: string;
  sentence_ko: string;
  start_sec: number; // 원래 대본에서 이 단어가 나오는 시각
};

/** 예문이 나온 작업(샘플 학습 자료). 이 작업이 DB에 있으면 "들으러 가기" 링크를 붙이고, 없으면 링크 없이 넣는다. */
export { SAMPLE_JOB_ID as STARTER_JOB_ID } from "./sample";

export const STARTER_WORDS: StarterWord[] = [
  {
    word: "conglomerate",
    lemma: "conglomerate",
    part_of_speech: "명사",
    meaning_ko: "대기업, 거대 복합 기업",
    sentence_en:
      "And we are your hosts. Today we are covering a company that Wikipedia describes as a Chinese multinational investment holding conglomerate founded in 1998. Of course, this is Tencent.",
    sentence_ko:
      "그리고 저희는 진행을 맡은 벤과 데이비드입니다. 오늘 저희가 다룰 기업은 위키피디아에서 1998년에 설립된 중국의 다국적 투자 지주 재벌이라고 소개하는 회사입니다. 바로 텐센트죠.",
    start_sec: 47.5,
  },
  {
    word: "notoriously",
    lemma: "notoriously",
    part_of_speech: "부사",
    meaning_ko: "악명 높게",
    sentence_en:
      "spoilers. Well, so what is Tencent besides that very long definition that feels conglomeraty? Well, first off, they're they're notoriously bad at PR, and they they actually talk about this as a company. You probably don't have them in your mind as one of the world's most important companies unless you're in gaming or maybe social media. So, starting off with that first, Tencent is the world's largest gaming company.",
    sentence_ko:
      "스포일러네요. 자, 그럼 그 거창하고 문어발식 기업 같은 정의 말고 텐센트는 과연 어떤 회사일까요? 우선, 텐센트는 PR을 지독하게 못하기로 유명해요. 회사 자체도 이 점을 인정하고 있죠. 게임이나 소셜 미디어를 잘 아는 사람이 아니라면, 아마 세계에서 가장 중요한 기업 중 하나로 텐센트를 떠올리진 않으실 거예요. 하지만 먼저 말씀드리자면, 텐센트는 세계에서 가장 큰 게임 회사입니다.",
    start_sec: 69.3,
  },
  {
    word: "capitalist",
    lemma: "capitalist",
    part_of_speech: "형용사",
    meaning_ko: "자본주의의",
    sentence_en:
      "It's part of the Pearl River Delta, uh, region, named Regional Economic Zone. It is located right across the bay of Shenzhen from Hong Kong. Uh, so this is super important. The history is really interesting. So, before the post Mao reforms in China and the kind of opening up of China and introduction of the capitalist market system, the legend is that that Shenzhen was just a fishing village.",
    sentence_ko:
      "이곳은 주강 삼각주 지역 경제 특구의 일부입니다. 홍콩에서 선전만 바로 건너편에 위치해 있죠. 그래서 이게 엄청나게 중요합니다. 역사가 정말 흥미로워요. 마오쩌둥 이후의 개혁 개방과 자본주의 시장 경제가 도입되기 이전 선전은 전설에 따르면 그냥 어촌 마을이었다고 합니다.",
    start_sec: 636.1,
  },
  {
    word: "weed",
    lemma: "weed",
    part_of_speech: "명사",
    meaning_ko: "잡초",
    sentence_en:
      "The company is still growing like a weed. They're adding 500,000 users a day. In 2001 they surged past 100 million users. Like this is crazy. And again, remember internet cafes like nuts. They're beating the bushes though. They're They're They're They're still trying to sell the company cuz they're like, okay, great. We've got 100 million users. We're super valuable to somebody.",
    sentence_ko:
      "회사는 여전히 잡초처럼 엄청난 속도로 성장하고 있었어요. 하루에 50만 명의 사용자가 늘어났죠. 2001년에는 사용자 1억 명을 돌파합니다. 정말 말도 안 되는 속도죠. 다시 말하지만 PC방 열풍이 엄청났던 거예요. 그렇다고 가만히 있던 건 아니었어요. 여전히 회사를 팔려고 백방으로 뛰어다녔거든요. '좋아, 사용자 1억 명을 모았으니 누군가에게는 엄청 가치 있는 회사일 거야'라고 생각한 거죠.",
    start_sec: 2129,
  },
  {
    word: "unrests",
    lemma: "unrest",
    part_of_speech: "명사",
    meaning_ko: "불안, 소요",
    sentence_en:
      "Now Ma is super precocious. He's like a great student, totally excels at everything. He graduates from high school in 1989. He does knocks it out of the park like for you know, I don't know if he was technically first in his class, but like top of his class in his college entrance exams. He could go wherever he wants, but he and his parents choose for him to stay at home and go to Shenzhen University instead of going elsewhere to better schools in the country, um, because this is 1989, and if you know your Chinese history, there's something else going on in 1989, which is the student protests and unrests and, um, they decide it's better for him to stay at home and stay in the special economic zone.",
    sentence_ko:
      "마화텅은 엄청나게 조숙한 아이였습니다. 공부도 잘하고 모든 면에서 뛰어났죠. 1989년에 고등학교를 졸업하는데, 대학 입학시험에서 거의 수석을 차지할 정도로 엄청난 성적을 거둡니다. 원한다면 전국 어디의 더 좋은 명문대학이든 갈 수 있었지만, 그와 부모님은 다른 지역으로 가는 대신 선전에 남기로 결정합니다. 왜냐하면 때는 1989년이었고, 중국 현대사를 아신다면 1989년에 학생 운동과 소요 사태 등 다른 큰 사건들이 있었다는 걸 아실 겁니다. 그래서 가족들은 그가 집에 남아 경제 특구 안에 머무는 것이 더 낫다고 판단한 거죠.",
    start_sec: 880.8,
  },
  {
    word: "precursor",
    lemma: "precursor",
    part_of_speech: "명사",
    meaning_ko: "선구자, 전신",
    sentence_en:
      "WAP's required sort of like a, I guess not necessarily a color screen, but some kind of like actual dot matrix thing that you could display almost HTML on, right? It was like some janky images and really low quality gifts and text that you could scroll. So, I think like it's it's like a slightly more primitive precursor to WAP.",
    sentence_ko:
      "WAP은 뭐랄까, 꼭 컬러 화면일 필요는 없겠지만 HTML을 거의 띄울 수 있는 어떤 도트 매트릭스 같은 게 필요했죠? 엉성한 이미지랑 아주 저화질의 gif, 그리고 스크롤할 수 있는 텍스트 같은 거였어요. 그러니까 WAP보다 약간 더 원시적인 전단계 같은 거네요.",
    start_sec: 1183.5,
  },
];

# 한자 작업 결정 기록 (내부 문서, 2026-10-31)

사용자가 "학습 효율과 정확성을 고려해 직접 판단"하도록 맡긴 4가지 결정과 적용 기준.

## 1. 한자 급수 분류 기준
- **결정**: N3 = 이 사이트 N3 단어장에 나오는 한자(586자), N1 = N1 단어장에만 나오는 한자(401자). 합계 987자.
- **이유**: JLPT는 급수별 공식 한자 목록을 공개하지 않는다. 학습자가 실제로 공부하는 단어에 나오는 한자를 기준으로 하면, 모든 한자에 대표 단어가 연결되고(학습 효율), 근거가 분명하다(정확성).
- **화면 표기**: "N1·N3 구분은 이 사이트 단어장에 나오는 한자를 기준으로 했어요. JLPT는 급수별 공식 한자 목록을 공개하지 않아요." 공식 목록처럼 쓰지 않는다.
- **기록 보존**: 예전 N1 목록의 意·心·不·見은 N3로 분류된다. 방별 학습 기록(n1lab:kanji)은 지우지 않았고, 한자 화면의 '전체' 필터에서 그대로 보인다. 예전 목록 파일(data/kanji/n1.json, n3.json)도 그대로 둔다.

## 2. 기존 70자 중 공개 자료와 다른 18자
- **결정**: 화면에는 공개 자료로 확인한 훈음(data/kanji/index.json)을 보여 준다. 예전 값(data/kanji/common.json의 ko)은 파일에 그대로 둔다.
- **이유**: 예전 값은 AI가 작성했고 공개 자료에서 확인되지 않았다. 확인된 값을 쓰는 것이 정확하다. 예전 값을 지우지 않아 되돌릴 수 있다.
- **적용**: js/kanji.js의 kanjiInfo가 index.json의 ko를 우선한다(common.json의 뜻 설명·연상 이야기·부수 등은 그대로 사용).

## 3. 한자별 대표 훈 선정 방식
- **결정**: 자료(libhangul·한국어 위키낱말사전)에 실린 훈 중에서만 고른다. 여러 개면 일본어에서 쓰는 뜻에 가장 가까운 것을 고른다. 나머지 훈은 상세 창에 '다른 뜻'으로 보여 준다.
- **이유**: 자료에 없는 훈을 만들면 정확성이 떨어진다. 일본어 뜻에 맞는 훈이 학습에 도움이 된다(예: 発 '필 발', 数 '셈 수', 謙 '겸손할 겸').
- **적용**: 자동 일치 797자 중 26자는 일본어 뜻에 맞는 다른 자료 값으로 바꿈(tools/kanji/overrides.tsv). 위키 기본형(예: 피다)은 관형형(필)으로만 바꾸어 적었다. 자료에 맞는 값이 없으면(예: 乾 '마를'은 자료상 음이 '간') 바꾸지 않았다.
- **근거 부족 3자**: 枠(한국 음·훈 없음)는 '일본에서 만든 한자'로만, 込·働은 음(입·동)만 보여 준다. 훈을 지어내지 않았다.

## 4. libhangul 저작권 표시
- **결정(사용자 지시)**: 웹사이트 화면에는 넣지 않는다.
- **라이선스 준수(내부 관리)**:
  - libhangul hanja.txt는 BSD 3-Clause. 재배포 시 저작권 표시·조건·면책 문구를 유지해야 한다. → 사이트가 배포하는 자료 파일 data/kanji/index.json의 meta.sources에 "Copyright (c) 2005,2006 Choe Hwanjin, BSD 3-Clause"를 적었고, 원문 조건은 docs/kanji-hun/README.md와 아래에 남긴다. 저자 이름을 홍보·보증에 쓰지 않는다.
  - 한국어 위키낱말사전(CC BY-SA): 출처 표시와 같은 조건 공유. → index.json meta.sources와 README에 출처를 적었다. 훈음 자료는 사실 정보(한 글자 훈·음)만 대조·선정에 썼다.
  - KANJIDIC2(CC BY-SA 4.0)·KanjiVG(CC BY-SA 3.0): 한자 상세 창 '자료 정보'에 출처를 표시하고 있다(기존과 같음). 획순 SVG 파일 안의 KanjiVG 저작권 머리말을 지우지 않는다.
  - Unicode Unihan: Unicode 이용 조건. 이체자 연결에만 사용.

### libhangul 라이선스 원문 (hanja.txt 머리말)
```
Copyright (c) 2005,2006 Choe Hwanjin
All rights reserved.
Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the author nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## 내부에서만 관리하는 것 (화면에 표시하지 않음)
- index.json의 q(1 자료 일치, 2 비교 선정, 3 근거 부족)와 src(근거).
- 사람 확인을 권장하는 한자: 冗·般·駄·填·台·詫·戻 (훈이 일본어 뜻과 거리가 있거나 자료마다 다름).
- 예문의 review(self_reviewed)와 check(자동 검사 결과).

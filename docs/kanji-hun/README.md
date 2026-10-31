# 한자 한국어 훈음 조사 결과 (987자)

- `한자훈음-조사결과-987자.csv`: 이 사이트 N1·N3 단어장에 나오는 한자 987자의 한국어 훈음 조사 결과(엑셀로 열 수 있음). 아직 사이트 화면에는 반영하지 않았다.
- `picks.tsv`: 자료끼리 표현이 달라 직접 비교해 대표 훈음을 고른 190자의 선정 내용과 근거(한자 · 단계 · 대표 훈음 · 근거).
- `oldvar.tsv`: Unicode Unihan의 kJapaneseOldVariant(일본 신자체 → 구자체) 362쌍.
- 만드는 스크립트: `tools/kanji/classify.ps1` (사용법은 NEXT_SESSION_HANDOFF.md).

## 결과 단계
- 1 신뢰할 수 있는 자료로 확인 완료(797자): libhangul과 한국어 위키낱말사전의 훈·음이 일치하고, 음은 KANJIDIC2 또는 Unihan으로도 확인.
- 2 복수 자료 비교로 합리적 확인(187자): 음은 여러 자료가 일치, 훈은 자료마다 표현이 달라 비교해 선정. 이 중 23자는 훈이 1개 자료에만 있음. 冗·般·駄·填 등은 사람 확인 권장.
- 3 충분한 근거 없음(3자): 枠·込·働(일본에서 만든 한자). 훈음을 지어내지 않았다.

## 자료 출처와 이용 조건
- libhangul `data/hanja/hanja.txt` — Copyright (c) 2005,2006 Choe Hwanjin, BSD 3-Clause License. https://github.com/libhangul/libhangul
- 한국어 위키낱말사전 덤프(2026-10-01) — CC BY-SA. https://dumps.wikimedia.org/kowiktionary/
- 영어판 위키낱말사전(몇 쪽만 확인) — CC BY-SA.
- KANJIDIC2 — EDRDG, CC BY-SA 4.0.
- Unicode Unihan Database (Unicode 18.0) — https://www.unicode.org/terms_of_use.html
- 쓰지 않은 자료: 네이버 한자사전(자동 수집 금지 약관, 링크만 사용), nihongokanji.com("무단 전재 및 재배포 금지").

## 주의
일본 신자체 중 다른 한자와 모양이 같은 글자(担·証·予·円·芸·糸·欠 등)는 반드시 일본 구자체(擔·證·豫·圓·藝·絲·缺)의 훈음을 써야 한다. 스크립트는 kJapaneseOldVariant를 먼저 찾는다.

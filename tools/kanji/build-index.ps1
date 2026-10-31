# 한자 987자 사이트 자료(data/kanji/index.json) 만들기
# 한국어 훈음: 조사 결과 CSV(+수동 선정 picks, 일본어 뜻에 맞춘 overrides) · 음독/훈독: KANJIDIC2 · 획수: KanjiVG 획 수
param([string]$RepoDir, [string]$Scr)
$enc = [Text.Encoding]::UTF8
$rows = Import-Csv "$Scr\kj\한자훈음-조사결과-987자.csv" -Encoding UTF8
$ov = @{}; foreach ($l in [IO.File]::ReadAllLines("$Scr\kj\overrides.tsv", $enc)) { $a = $l.Split("`t"); if ($a.Count -ge 3) { $ov[$a[0]] = $a } }
$want = @{}; $rows | ForEach-Object { $want[$_."한자"] = 1 }
# KANJIDIC2 음독·훈독
$kd = @{}
$xs = New-Object Xml.XmlReaderSettings; $xs.DtdProcessing = "Parse"; $xs.XmlResolver = $null; $xs.MaxCharactersFromEntities = 0
$xr = [Xml.XmlReader]::Create("$Scr\kanjidic-dl\kanjidic2.xml", $xs); $cur = ""
while ($xr.Read()) {
  if ($xr.NodeType -ne "Element") { continue }
  if ($xr.Name -eq "literal") { $cur = $xr.ReadElementContentAsString(); if ($want.ContainsKey($cur)) { $kd[$cur] = @{ on = @(); kun = @() } } }
  elseif ($xr.Name -eq "reading" -and $kd.ContainsKey($cur)) {
    $t = $xr.GetAttribute("r_type"); $v = $xr.ReadElementContentAsString()
    if ($t -eq "ja_on" -and $v -notmatch "^-|-$") { $kd[$cur].on += $v }
    if ($t -eq "ja_kun" -and $v -notmatch "^-|-$") { $k = $v.Replace(".", "-"); if ($kd[$cur].kun -notcontains $k) { $kd[$cur].kun += $k } }
  }
}
$xr.Close()
# 훈독은 실제로 쓰는 말만: JMdict 상용 표기(ke_pri가 있는 말)이거나 이 사이트 단어장에 나오는 말
$common = New-Object 'System.Collections.Generic.HashSet[string]'; foreach ($w in [IO.File]::ReadLines("$Scr\kj\jm-common.txt", $enc)) { [void]$common.Add($w) }
foreach ($f in "data/n3/vocab.json", "data/n1/vocab.json", "data/vocabulary.json") { ([IO.File]::ReadAllText((Join-Path $RepoDir $f), $enc) | ConvertFrom-Json).items | ForEach-Object { [void]$common.Add($_.word) } }
$kunAll = 0; $kunKept = 0
foreach ($c in @($kd.Keys)) { $keep = @($kd[$c].kun | Where-Object { $common.Contains($c + ($_ -replace "^[^-]*-?", "")) }); $kunAll += $kd[$c].kun.Count; $kunKept += $keep.Count; $kd[$c].kun = $keep }
"훈독 {0}개 중 {1}개 남김" -f $kunAll, $kunKept
$items = foreach ($x in $rows) {
  $c = $x."한자"; $cat = $x."결과".Substring(0, 1)
  $rep = $x."대표 훈음"; $why = $x."판단 근거"
  if ($ov.ContainsKey($c)) { $rep = $ov[$c][1]; $why = "일본어 뜻에 맞춰 대표 훈 선택: " + $ov[$c][2] }
  $hun = ""; $eum = ""
  if ($rep) { $p = $rep -split " "; $eum = $p[-1]; $hun = ($p[0..($p.Count - 2)] -join " ") }
  if (-not $eum -and $cat -eq "3") { $e = @($x."KANJIDIC2 음" -split ",")[0]; if ($e) { $eum = $e } }   # 込·働: 음만 확인
  $alt = @($x."libhangul 훈음" -split ",\s*" | Where-Object { $_ -and $_ -ne $rep -and $_ -match " " -and $_ -notmatch "[一-鿿]" } | Select-Object -Unique | Select-Object -First 3)
  $cp = [char]::ConvertToUtf32($c, 0); $ref = "{0:x5}" -f $cp
  $svg = "$RepoDir\data\kanjivg\$ref.svg"; $n = 0
  if (Test-Path $svg) { $n = ([regex]::Matches([IO.File]::ReadAllText($svg, $enc), 'id="kvg:' + $ref + '-s\d+"')).Count }
  [ordered]@{
    char = $c; lv = $x."급수(사이트 단어장 기준)"; ko = [ordered]@{ hun = $hun; eum = $eum }; alt = $alt
    on = @($kd[$c].on); kun = @($kd[$c].kun); strokes = $n; strokeRef = $ref
    kokuji = ($why -like "*일본 고유 한자*"); q = [int]$cat; src = $why
  }
}
$meta = [ordered]@{
  title = "한자 987자 (N1·N3 단어장에 나오는 한자)"; updated = "2026-10-31"
  levels = "lv는 이 사이트 단어장 기준: N3 = N3 단어장에 나오는 한자, N1 = N1 단어장에만 나오는 한자. JLPT는 공식 급수별 한자 목록을 공개하지 않는다."
  fields = "ko = 한국어 대표 훈음, alt = 같은 자료의 다른 훈음, on/kun = KANJIDIC2 음독·훈독, strokes = KanjiVG 획 수, q = 내부 검증 단계(1 자료 일치, 2 비교 선정, 3 근거 부족 — 화면에 표시하지 않음), src = 내부 근거"
  sources = "한국어 훈음: libhangul hanja.txt (Copyright (c) 2005,2006 Choe Hwanjin, BSD 3-Clause), 한국어 위키낱말사전 (CC BY-SA), Unicode Unihan. 음독·훈독: KANJIDIC2 (EDRDG, CC BY-SA 4.0). 획순: KanjiVG (CC BY-SA 3.0). 자세한 내용은 docs/kanji-hun/README.md"
}
$lines = $items | ForEach-Object { "    " + ([pscustomobject]$_ | ConvertTo-Json -Compress -Depth 5) }
$out = "{`n  `"meta`": " + ([pscustomobject]$meta | ConvertTo-Json -Compress) + ",`n  `"items`": [`n" + ($lines -join ",`n") + "`n  ]`n}`n"
[IO.File]::WriteAllText("$RepoDir\data\kanji\index.json", $out, (New-Object Text.UTF8Encoding $false))
"한자 {0}자 · 훈 있음 {1} · 음만 {2} · 없음 {3} · 획수 0인 것 {4} · 음독/훈독 없음 {5}" -f @($items).Count, @($items | Where-Object { $_.ko.hun }).Count, @($items | Where-Object { -not $_.ko.hun -and $_.ko.eum }).Count, @($items | Where-Object { -not $_.ko.eum }).Count, @($items | Where-Object { $_.strokes -eq 0 }).Count, @($items | Where-Object { -not $_.on.Count -and -not $_.kun.Count }).Count
